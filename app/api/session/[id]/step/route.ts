import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api/helpers";
import { validateAnswerValue, crossValidateAnswer, type AnswerValue } from "@/lib/quiz/validate-answer";
import { deriveCurrentStep } from "@/lib/session/progress";

/**
 * POST /api/session/[id]/step —— 分步保存（增量）。
 * 幂等：UNIQUE(session_id, step_key) upsert，重复提交 = update。
 * current_step 由服务端从全部已答集合重新推导，不信任客户端。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  let body: { stepKey?: string; answerValue?: AnswerValue };
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }
  const { stepKey, answerValue } = body ?? {};
  if (!stepKey) return jsonError("stepKey_required", 400);

  // 会话归属 + 状态校验（RLS 之外显式校验）
  const { data: session } = await supabase
    .from("assessment_session")
    .select("id, user_id, status")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();
  if (!session) return jsonError("session_not_found", 404);
  if (session.status === "completed") return jsonError("session_completed", 409);

  const errs = validateAnswerValue(stepKey, answerValue ?? {});
  if (errs.length > 0) return NextResponse.json({ error: "invalid_answer", detail: errs }, { status: 400 });

  // 与已持久化答案交叉校验（如 target_weight vs weight+goal）
  const { data: prior } = await supabase
    .from("assessment_answer")
    .select("step_key, answer_value")
    .eq("session_id", id)
    .neq("step_key", stepKey);
  const saved = Object.fromEntries(
    (prior ?? []).map((a) => [a.step_key, a.answer_value as AnswerValue])
  );
  const crossErrs = crossValidateAnswer(stepKey, answerValue ?? {}, saved);
  if (crossErrs.length > 0)
    return NextResponse.json({ error: "cross_validation_failed", detail: crossErrs }, { status: 400 });

  const { error: upErr } = await supabase.from("assessment_answer").upsert(
    {
      session_id: id,
      step_key: stepKey,
      answer_value: JSON.parse(JSON.stringify(answerValue)),
    },
    { onConflict: "session_id,step_key" }
  );
  if (upErr) return jsonError(upErr.message, 500);

  // 重新推导进度
  const { data: all } = await supabase
    .from("assessment_answer")
    .select("step_key")
    .eq("session_id", id);
  const currentStep = deriveCurrentStep(new Set((all ?? []).map((a) => a.step_key)));
  await supabase
    .from("assessment_session")
    .update({ current_step: currentStep })
    .eq("id", id);

  return NextResponse.json({ ok: true, currentStep });
}
