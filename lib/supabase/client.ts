import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** 浏览器端 Supabase 客户端（单例；会话由 @supabase/ssr 存 cookie） */
export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}

const SESSION_ID_KEY = "betterme.sessionId";

export function getStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_ID_KEY);
}

export function storeSessionId(id: string) {
  localStorage.setItem(SESSION_ID_KEY, id);
}

export function clearStoredSessionId() {
  localStorage.removeItem(SESSION_ID_KEY);
}

/**
 * 确保返回一个「当前用户真正可用」的 sessionId。
 * 顺序（修复"进度恢复失败 401"根因）：
 *  1) 先确保匿名登录成功（@supabase/ssr cookie 有效）
 *  2) 若 localStorage 有旧 sessionId，用 GET 校验它是否仍属于当前用户
 *     —— 401/404/任何非 200 都说明 stale（cookie 已清/会话过期/服务重启），丢弃重建
 *  3) 无有效 sessionId 则新建
 */
export async function ensureSession(): Promise<string> {
  const sb = getSupabaseBrowserClient();

  // 1) 确保匿名登录（cookie 有效）
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) throw new Error("匿名登录失败：" + error.message);
  }

  // 2) 校验旧 sessionId 是否仍有效
  const stored = getStoredSessionId();
  if (stored) {
    const res = await fetch(`/api/session/${stored}`);
    if (res.ok) return stored;
    // stale：丢弃，走新建
    clearStoredSessionId();
  }

  // 3) 新建
  const res = await fetch("/api/session", { method: "POST" });
  if (!res.ok) throw new Error("开会话失败：" + res.status);
  const { sessionId } = (await res.json()) as { sessionId: string };
  storeSessionId(sessionId);
  return sessionId;
}
