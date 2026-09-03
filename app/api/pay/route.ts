import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api/helpers";
import { randomUUID } from "crypto";

/** 订阅时长（天）——模拟订阅 N 天 */
const SUBSCRIPTION_DAYS = 30;

/**
 * POST /api/pay —— 模拟支付回调（用户级，拒绝匿名）。
 * - 匿名用户（无 email）→ 403，先 /api/upgrade
 * - 续期不缩短：expires_at = greatest(coalesce(expires_at, now), now) + N 天
 * - 幂等：payment_event_id 唯一；同一 user upsert
 */
export async function POST() {
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  if (!user!.email) {
    return NextResponse.json(
      { error: "anonymous_forbidden", message: "请先升级为正式账号再订阅" },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from("subscription")
    .select("id, expires_at")
    .eq("user_id", user!.id)
    .single();

  const now = new Date();
  const baseExpires = existing?.expires_at ? new Date(existing.expires_at) : now;
  const anchor = baseExpires > now ? baseExpires : now; // 续期不缩短
  const expiresAt = new Date(anchor.getTime() + SUBSCRIPTION_DAYS * 86400000);

  const row = {
    user_id: user!.id,
    status: "active",
    starts_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    payment_event_id: randomUUID(),
    paid_at: now.toISOString(),
    amount: 9.9,
  };

  const { error } = await supabase
    .from("subscription")
    .upsert(row, { onConflict: "user_id" });
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ ok: true, expiresAt: row.expires_at });
}
