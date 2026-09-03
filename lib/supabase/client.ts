import { randomUUID } from "crypto";
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

/** 确保匿名登录 + 开会话（幂等：已有 sessionId 直接返回） */
export async function ensureSession(): Promise<string> {
  const sb = getSupabaseBrowserClient();
  const stored = getStoredSessionId();
  if (stored) return stored;

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) throw new Error("匿名登录失败：" + error.message);
  }
  const res = await fetch("/api/session", { method: "POST" });
  if (!res.ok) throw new Error("开会话失败：" + res.status);
  const { sessionId } = (await res.json()) as { sessionId: string };
  storeSessionId(sessionId);
  return sessionId;
}

export { randomUUID };
