import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api/helpers";
import { isSubscriptionActive, maskResult } from "@/lib/subscription/gate";

/**
 * GET /api/session/[id]/result —— 结果页数据（差异化返回）。
 * 判断基准是「当前用户的订阅」（用户级）：有效 → 完整；无效 → 脱敏 + locked:true。
 * 非会员物理上拿不到 predictionCurve / weeklyRateKg。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  // 会话归属校验
  const { data: session } = await supabase
    .from("assessment_session")
    .select("id, user_id, status")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();
  if (!session) return jsonError("session_not_found", 404);

  const { data: result } = await supabase
    .from("assessment_result")
    .select(
      "bmi, bmi_category, recommended_calories, target_date, prediction_curve, plan_30d, algorithm_version, calculated_at"
    )
    .eq("session_id", id)
    .single();
  if (!result) return jsonError("result_not_ready", 404);

  const { data: sub } = await supabase
    .from("subscription")
    .select("status, starts_at, expires_at")
    .eq("user_id", user!.id)
    .single();

  const unlocked = isSubscriptionActive(sub);

  // 30 天计划：非会员仅 Day1 预览（其余 29 天物理不可见）
  const planFull = result.plan_30d as { version: string; days: unknown[] } | null;
  const plan = planFull
    ? unlocked
      ? { totalDays: planFull.days.length, previewDays: planFull.days }
      : { totalDays: planFull.days.length, previewDays: planFull.days.slice(0, 1) }
    : null;

  const payload = {
    bmi: result.bmi,
    bmiCategory: result.bmi_category,
    recommendedCalories: result.recommended_calories,
    targetDate: result.target_date,
    predictionCurve: result.prediction_curve,
    weeklyRateKg: undefined as number | undefined,
    algorithmVersion: result.algorithm_version,
    calculatedAt: result.calculated_at,
    plan,
  };
  // weeklyRateKg 与曲线同源：从曲线首末差推回（不重复存列）
  const curve = result.prediction_curve as { week: number; weightKg: number }[];
  if (Array.isArray(curve) && curve.length >= 2) {
    const dw = curve[curve.length - 1].weightKg - curve[0].weightKg;
    const weeks = curve[curve.length - 1].week - curve[0].week;
    payload.weeklyRateKg = weeks > 0 ? Math.round((dw / weeks) * 100) / 100 : 0;
  }

  const masked = maskResult(payload, unlocked);
  return NextResponse.json({
    ...masked,
    subscription: unlocked
      ? { status: "active", expiresAt: sub!.expires_at }
      : { status: "inactive" },
  });
}
