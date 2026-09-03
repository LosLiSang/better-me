import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api/helpers";
import { deriveCurrentStep } from "@/lib/session/progress";

/** GET /api/session/[id] —— 进度恢复：返回已填答案 + 服务端推导的当前步 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data: session, error: sErr } = await supabase
    .from("assessment_session")
    .select("id, status, current_step, quiz_version")
    .eq("id", id)
    .single();
  if (sErr || !session) return jsonError("session_not_found", 404);

  // 归属校验（RLS 之外显式再查一次，双保险）
  const { data: own } = await supabase
    .from("assessment_session")
    .select("user_id")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();
  if (!own) return jsonError("session_not_found", 404);

  const { data: answers } = await supabase
    .from("assessment_answer")
    .select("step_key, answer_value")
    .eq("session_id", id);

  const answeredKeys = new Set((answers ?? []).map((a) => a.step_key));
  return NextResponse.json({
    sessionId: session.id,
    status: session.status,
    quizVersion: session.quiz_version,
    currentStep: deriveCurrentStep(answeredKeys),
    answers: Object.fromEntries(
      (answers ?? []).map((a) => [a.step_key, a.answer_value])
    ),
  });
}
