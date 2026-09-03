/**
 * 答案形态校验 —— 按题库配置校验用户提交的 answer_value。
 * 题库是单源：选项值、min/max、互斥规则全部来自 config，不在此重复。
 *
 * answer_value 存储形态：
 *   single/likert/number → { value: string | number }
 *   multi                → { values: string[] }
 *
 * 返回错误列表（空数组 = 合法），消息含 stepKey 便于定位。
 */

import { getQuestion } from "./config";

export interface AnswerValue {
  value?: string | number;
  values?: string[];
}

export function validateAnswerValue(stepKey: string, answer: AnswerValue): string[] {
  const errs: string[] = [];
  const q = getQuestion(stepKey);
  if (!q) return [`${stepKey}: 未知 stepKey`];
  if (!answer || typeof answer !== "object") return [`${stepKey}: answer_value 缺失`];

  if (q.type === "multi") {
    const values = answer.values;
    if (!Array.isArray(values)) return [`${stepKey}: multi 应提交 values 数组`];
    if (values.length === 0) return [`${stepKey}: multi 至少选一项`];
    const opts = new Map((q.options ?? []).map((o) => [o.value, o]));
    for (const v of values) {
      if (!opts.has(v)) errs.push(`${stepKey}: 未知选项 ${v}`);
    }
    const exclusive = (q.options ?? []).find((o) => o.exclusive);
    if (exclusive && values.includes(exclusive.value) && values.length > 1) {
      errs.push(`${stepKey}: "${exclusive.label}" 与其它选项互斥`);
    }
    return errs;
  }

  // single / likert / number 均为单值
  if (answer.values !== undefined) return [`${stepKey}: 该题型应提交 value 而非 values`];
  const v = answer.value;
  if (v === undefined || v === null) return [`${stepKey}: 缺少 value`];

  if (q.type === "number") {
    if (typeof v !== "number" || !Number.isFinite(v))
      return [`${stepKey}: 应为数值`];
    const n = q.numeric!;
    if (v < n.min || v > n.max)
      return [`${stepKey}: 超出范围 [${n.min}, ${n.max}] ${n.unit}`];
    return errs;
  }

  // single / likert：value 必须是配置的选项值
  const valid = new Set((q.options ?? []).map((o) => o.value));
  if (typeof v !== "string" || !valid.has(v))
    errs.push(`${stepKey}: 非法选项 ${String(v)}`);
  return errs;
}

/**
 * 跨字段校验：把当前提交与「已持久化的其它答案」交叉验证。
 * 依赖字段尚未提交时不校验（留给 complete 兜底），避免误拒。
 * 覆盖双向：提交 target_weight 查已存 goal/weight；提交 goal 查已存 target_weight。
 */
export function crossValidateAnswer(
  stepKey: string,
  answer: AnswerValue,
  saved: Record<string, AnswerValue>
): string[] {
  const errs: string[] = [];
  const num = (x: AnswerValue | undefined) =>
    x && typeof x.value === "number" ? x.value : undefined;
  const str = (x: AnswerValue | undefined) =>
    x && typeof x.value === "string" ? x.value : undefined;

  if (stepKey === "target_weight") {
    const target = num(answer);
    const weight = num(saved["weight"]);
    const goal = str(saved["goal"]);
    if (target === undefined || weight === undefined || !goal) return errs;
    if (goal === "lose_weight" && target >= weight)
      errs.push(`target_weight: 减重目标应小于当前体重(${weight}kg)`);
    if (goal === "gain_weight" && target <= weight)
      errs.push(`target_weight: 增重目标应大于当前体重(${weight}kg)`);
    if (goal === "maintain" && Math.abs(target - weight) > 1)
      errs.push(`target_weight: maintain 目标应与当前体重相差 ≤1kg`);
  }

  if (stepKey === "goal") {
    const goal = str(answer);
    const weight = num(saved["weight"]);
    const target = num(saved["target_weight"]);
    if (target === undefined || weight === undefined || !goal) return errs;
    if (goal === "lose_weight" && target >= weight)
      errs.push(`goal: 已存目标体重(${target}kg)与减重目标冲突`);
    if (goal === "gain_weight" && target <= weight)
      errs.push(`goal: 已存目标体重(${target}kg)与增重目标冲突`);
    if (goal === "maintain" && Math.abs(target - weight) > 1)
      errs.push(`goal: 已存目标体重(${target}kg)与 maintain 冲突`);
  }

  return errs;
}
