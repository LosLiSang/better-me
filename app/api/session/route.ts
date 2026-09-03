import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api/helpers";
import { QUIZ_VERSION } from "@/lib/quiz/config";

/** POST /api/session —— 开新会话（匿名登录成功后调用；user 由 cookie 会话得出） */
export async function POST() {
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase
    .from("assessment_session")
    .insert({ user_id: user!.id, quiz_version: QUIZ_VERSION })
    .select("id, current_step")
    .single();

  if (error) {
    console.error("[POST /api/session] insert failed:", error.message, error.details, error.hint);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({
    sessionId: data.id,
    currentStep: data.current_step,
  });
}
