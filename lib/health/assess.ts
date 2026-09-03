/**
 * 健康评估算法（服务端纯函数，v1）
 *
 * 设计依据：`doc/架构设计.md` §4。
 * - BMI 与分类
 * - Mifflin-St Jeor BMR × 活动系数 ± 目标调整 = 建议摄入（下限兜底 1200）
 * - 目标预测日期（按周速率：减重 0.5kg/周，增重 0.25kg/周）
 * - 预测曲线（按周体重序列，末点=目标体重）
 *
 * 纪律：
 * - 数值范围引用题库单源（getQuestion(key).numeric），不在本文件重复魔数。
 * - 年龄用档位中位岁数（AGE_RANGE_MIDPOINT），不重复定义。
 * - 校验先行：validateAssessInput 返回全部错误；assess 在非法输入时抛错。
 */

import { getQuestion, AGE_RANGE_MIDPOINT } from "../quiz/config";

export type Gender = "male" | "female";
export type Goal = "lose_weight" | "maintain" | "gain_weight";
export type ActivityFrequency = "sedentary" | "light" | "moderate" | "active";

export interface AssessInput {
  gender: Gender;
  /** 年龄档位（题库 age 选项 value） */
  ageBand: string;
  goal: Goal;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  activityFrequency: ActivityFrequency;
}

export interface PredictionPoint {
  week: number;
  weightKg: number;
}

export interface AssessResult {
  bmi: number;
  bmiCategory: BmiCategory;
  bmr: number;
  recommendedCalories: number;
  /** ISO 日期（yyyy-mm-dd） */
  targetDate: string;
  /** 周速率 kg/周（maintain 为 0） */
  weeklyRateKg: number;
  predictionCurve: PredictionPoint[];
}

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

/** 算法版本（存入 assessment_result.algorithm_version） */
export const ALGORITHM_VERSION = "v1";

/** 活动系数（单源） */
const ACTIVITY_FACTOR: Record<ActivityFrequency, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

/** 摄入安全下限（kcal/天） */
const CALORIE_FLOOR = 1200;
/** 减重速率 kg/周 */
const LOSE_RATE = 0.5;
/** 增重速率 kg/周 */
const GAIN_RATE = 0.25;
/** maintain 目标体重容差（kg） */
const MAINTAIN_TOLERANCE = 1;

/** 从题库取数字范围（单源） */
function range(key: string): { min: number; max: number } {
  const n = getQuestion(key)?.numeric;
  if (!n) throw new Error(`题库缺少数字题范围: ${key}`);
  return { min: n.min, max: n.max };
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** 校验输入，返回全部错误（空数组 = 合法）。错误消息含字段 key 便于定位。 */
export function validateAssessInput(input: AssessInput): string[] {
  const errs: string[] = [];
  const { gender, ageBand, goal, heightCm, weightKg, targetWeightKg, activityFrequency } = input;

  if (gender !== "male" && gender !== "female") errs.push("gender: 非法值");
  if (!(ageBand in AGE_RANGE_MIDPOINT)) errs.push(`age: 未知年龄档位 ${ageBand}`);
  if (!["lose_weight", "maintain", "gain_weight"].includes(goal)) errs.push("goal: 非法值");

  const h = range("height");
  if (!isFiniteNum(heightCm)) errs.push("height: 缺失或非数值");
  else if (heightCm < h.min || heightCm > h.max) errs.push(`height: 超出范围 [${h.min},${h.max}]`);

  const w = range("weight");
  if (!isFiniteNum(weightKg)) errs.push("weight: 缺失或非数值");
  else if (weightKg < w.min || weightKg > w.max) errs.push(`weight: 超出范围 [${w.min},${w.max}]`);

  const t = range("target_weight");
  if (!isFiniteNum(targetWeightKg)) errs.push("target_weight: 缺失或非数值");
  else if (targetWeightKg < t.min || targetWeightKg > t.max)
    errs.push(`target_weight: 超出范围 [${t.min},${t.max}]`);

  if (isFiniteNum(weightKg) && isFiniteNum(targetWeightKg)) {
    if (goal === "lose_weight" && targetWeightKg >= weightKg)
      errs.push("target_weight: 减重目标应小于当前体重");
    if (goal === "gain_weight" && targetWeightKg <= weightKg)
      errs.push("target_weight: 增重目标应大于当前体重");
    if (goal === "maintain" && Math.abs(targetWeightKg - weightKg) > MAINTAIN_TOLERANCE)
      errs.push(`target_weight: maintain 目标应与当前体重相差 ≤${MAINTAIN_TOLERANCE}kg`);
  }

  if (!(activityFrequency in ACTIVITY_FACTOR)) errs.push("activity_frequency: 非法档位");

  return errs;
}

export function bmiCategoryOf(bmi: number): BmiCategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isoDatePlusWeeks(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return localIsoDate(d);
}

/** 本地时区的 yyyy-mm-dd（不用 toISOString，避免 UTC 错位） */
function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 计算健康评估（非法输入抛 Error，消息含全部校验错误） */
export function assess(input: AssessInput): AssessResult {
  const errs = validateAssessInput(input);
  if (errs.length > 0) throw new Error(`评估输入非法: ${errs.join("; ")}`);

  const { gender, ageBand, goal, heightCm, weightKg, targetWeightKg, activityFrequency } = input;
  const age = AGE_RANGE_MIDPOINT[ageBand];

  // BMI
  const heightM = heightCm / 100;
  const bmi = round2(weightKg / (heightM * heightM));

  // Mifflin-St Jeor BMR
  const bmr =
    10 * weightKg + 6.25 * heightCm - 5 * age + (gender === "male" ? 5 : -161);

  // 建议摄入 = TDEE ± 目标调整，下限兜底
  const tdee = bmr * ACTIVITY_FACTOR[activityFrequency];
  const adjustment = goal === "lose_weight" ? -500 : goal === "gain_weight" ? 300 : 0;
  const recommendedCalories = Math.max(Math.round(tdee + adjustment), CALORIE_FLOOR);

  // 目标日期与预测曲线
  const diff = targetWeightKg - weightKg; // 负=减，正=增
  const weeklyRateKg = goal === "maintain" ? 0 : diff < 0 ? -LOSE_RATE : GAIN_RATE;
  const weeks = goal === "maintain" ? 0 : Math.ceil(Math.abs(diff) / Math.abs(weeklyRateKg));

  const predictionCurve: PredictionPoint[] = [];
  for (let w = 0; w <= weeks; w++) {
    let weight = weightKg + weeklyRateKg * w;
    // 末点钉到目标，避免速率取整漂移
    if (w === weeks) weight = targetWeightKg;
    // 中间点不越过目标
    if (diff < 0) weight = Math.max(weight, targetWeightKg);
    else if (diff > 0) weight = Math.min(weight, targetWeightKg);
    predictionCurve.push({ week: w, weightKg: round2(weight) });
  }
  if (predictionCurve.length === 0) {
    predictionCurve.push({ week: 0, weightKg: round2(targetWeightKg) });
  }

  return {
    bmi,
    bmiCategory: bmiCategoryOf(bmi),
    bmr: Math.round(bmr),
    recommendedCalories,
    targetDate: goal === "maintain" ? localIsoDate(new Date()) : isoDatePlusWeeks(weeks),
    weeklyRateKg,
    predictionCurve,
  };
}
