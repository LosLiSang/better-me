import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api/helpers";
import { assess, ALGORITHM_VERSION, type AssessInput, type Gender, type Goal, type ActivityFrequency } from "@/lib/health/assess";
import { REQUIRED_CALC_KEYS } from "@/lib/quiz/config";

/**
 * POST /api/session/[id]/complete —— 触发服务端计算。
 * 答案从库里读（不接受前端传整份 answers），必填未齐 → 409。
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data: session } = await supabase
    .from("assessment_session")
    .select("id, user_id, status")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();
  if (!session) return jsonError("session_not_found", 404);
  if (session.status === "completed") return jsonError("already_completed", 409);

  const { data: answers } = await supabase
    .from("assessment_answer")
    .select("step_key, answer_value")
    .eq("session_id", id);
  const byKey = new Map((answers ?? []).map((a) => [a.step_key, a.answer_value as { value?: string | number }]));

  const missing = REQUIRED_CALC_KEYS.filter((k) => !byKey.has(k));
  if (missing.length > 0)
    return NextResponse.json({ error: "required_steps_missing", missing }, { status: 409 });

  // 从持久化答案提取计算输入（类型在题库已校验过，这里收敛为算法入参）
  const input: AssessInput = {
    gender: byKey.get("gender")!.value as Gender,
    ageBand: byKey.get("age")!.value as string,
    goal: byKey.get("goal")!.value as Goal,
    heightCm: byKey.get("height")!.value as number,
    weightKg: byKey.get("weight")!.value as number,
    targetWeightKg: byKey.get("target_weight")!.value as number,
    activityFrequency: byKey.get("activity_frequency")!.value as ActivityFrequency,
  };

  let result;
  try {
    result = assess(input);
  } catch (e) {
    // 数据层面被绕过校验写入（如乱序/历史脏数据）：fail-closed
    return NextResponse.json(
      { error: "assessment_failed", detail: (e as Error).message },
      { status: 422 }
    );
  }

  const { data: inserted, error: insErr } = await supabase
    .from("assessment_result")
    .upsert(
      {
        session_id: id,
        bmi: result.bmi,
        bmi_category: result.bmiCategory,
        recommended_calories: result.recommendedCalories,
        target_date: result.targetDate,
        prediction_curve: JSON.parse(JSON.stringify(result.predictionCurve)),
        algorithm_version: ALGORITHM_VERSION,
      },
      { onConflict: "session_id" }
    )
    .select("id")
    .single();
  if (insErr) return jsonError(insErr.message, 500);

  await supabase.from("assessment_session").update({ status: "completed" }).eq("id", id);

  return NextResponse.json({ resultId: inserted.id });
}
