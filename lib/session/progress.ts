/**
 * 进度推导 —— current_step 由服务端推导，不信任客户端上报。
 *
 * 语义：题库顺序中「第一个未作答题」之前的题数（即恢复时应进入的步序）；
 * 全部作答 = 题目总数（33）。乱序提交不推进超过第一个空隙。
 */

import { QUIZ_QUESTIONS } from "../quiz/config";

export function deriveCurrentStep(answeredKeys: Set<string>): number {
  for (let i = 0; i < QUIZ_QUESTIONS.length; i++) {
    const q = QUIZ_QUESTIONS[i];
    // 必填题未答 = 进度卡在这；可选题未答同样视为当前位置（可跳过由前端推进）
    if (!answeredKeys.has(q.key)) return i;
  }
  return QUIZ_QUESTIONS.length;
}
