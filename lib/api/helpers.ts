import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../supabase/server";

/**
 * 路由共享助手：取当前用户（含匿名）。
 * 未登录 → 401（纪律：登录成功前不做任何持久化，后端不接收无主数据）。
 */
export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      user: null,
      supabase,
      unauthorized: NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 }
      ),
    };
  }
  return { user, supabase, unauthorized: null };
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
