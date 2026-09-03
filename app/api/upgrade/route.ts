import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api/helpers";

/**
 * POST /api/upgrade —— 匿名用户升级为正式账号（订阅前置）。
 * auth.updateUser 保原 user_id：已填答案/会话全部保留。
 * 已有账号（邮箱被占用）→ 400 提示先登录（不做会话认领/合并，定案）。
 */
export async function POST(req: Request) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return jsonError("invalid_email", 400);
  if (password.length < 6) return jsonError("password_too_short", 400);

  const { error } = await supabase.auth.updateUser({ email, password });
  if (error) {
    // 常见：邮箱已被注册（updateUser 走身份链接时冲突）
    if (/already|registered|exists|identity/i.test(error.message))
      return NextResponse.json(
        { error: "email_taken", message: "该邮箱已有账号，请先用已有账号登录" },
        { status: 400 }
      );
    return NextResponse.json({ error: "upgrade_failed", message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
