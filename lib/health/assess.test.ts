import { describe, it, expect } from "vitest";
import { assess, validateAssessInput, type AssessInput } from "./assess";
import { getQuestion, AGE_RANGE_MIDPOINT } from "../quiz/config";

/** 合法基准输入（女，30-39，减重） */
const base: AssessInput = {
  gender: "female",
  ageBand: "30-39",
  goal: "lose_weight",
  heightCm: 165,
  weightKg: 72,
  targetWeightKg: 60,
  activityFrequency: "light",
};

describe("validateAssessInput 边界", () => {
  it("合法输入无错误", () => {
    expect(validateAssessInput(base)).toEqual([]);
  });

  it("缺失字段报错", () => {
    const bad = { ...base, heightCm: undefined as unknown as number };
    const errs = validateAssessInput(bad);
    expect(errs.some((e) => e.includes("height"))).toBe(true);
  });

  it("NaN / 非数值报错", () => {
    const errs = validateAssessInput({ ...base, weightKg: NaN });
    expect(errs.some((e) => e.includes("weight"))).toBe(true);
  });

  it("身高低于题库 min(100) 报错", () => {
    const min = getQuestion("height")!.numeric!.min;
    expect(validateAssessInput({ ...base, heightCm: min - 1 }).length).toBeGreaterThan(0);
  });

  it("体重超过题库 max(250) 报错", () => {
    const max = getQuestion("weight")!.numeric!.max;
    expect(validateAssessInput({ ...base, weightKg: max + 1 }).length).toBeGreaterThan(0);
  });

  it("目标体重 == 当前体重（减重目标）报错", () => {
    const errs = validateAssessInput({ ...base, targetWeightKg: 72 });
    expect(errs.some((e) => e.includes("target_weight"))).toBe(true);
  });

  it("减重目标但目标体重 > 当前体重报错", () => {
    const errs = validateAssessInput({ ...base, targetWeightKg: 80 });
    expect(errs.some((e) => e.includes("target_weight"))).toBe(true);
  });

  it("增重目标但目标体重 < 当前体重报错", () => {
    const errs = validateAssessInput({ ...base, goal: "gain_weight", targetWeightKg: 60 });
    expect(errs.some((e) => e.includes("target_weight"))).toBe(true);
  });

  it("增重目标合法（目标 ≥ 当前 + 1）", () => {
    expect(
      validateAssessInput({ ...base, goal: "gain_weight", targetWeightKg: 76 })
    ).toEqual([]);
  });

  it("maintain 允许目标接近当前（±1kg 容差）", () => {
    expect(
      validateAssessInput({ ...base, goal: "maintain", targetWeightKg: 71.5 })
    ).toEqual([]);
    expect(
      validateAssessInput({ ...base, goal: "maintain", targetWeightKg: 65 })
    ).toEqual([expect.stringContaining("target_weight")]);
  });

  it("非法 gender / 活动档位报错", () => {
    expect(validateAssessInput({ ...base, gender: "x" as never }).length).toBeGreaterThan(0);
    expect(
      validateAssessInput({ ...base, activityFrequency: "extreme" as never }).length
    ).toBeGreaterThan(0);
  });

  it("未知年龄档位报错（AGE_RANGE_MIDPOINT 无映射）", () => {
    expect(validateAssessInput({ ...base, ageBand: "0-9" }).length).toBeGreaterThan(0);
  });
});

describe("assess 计算", () => {
  it("BMI 正确（72kg/1.65m ≈ 26.45）", () => {
    const r = assess(base);
    expect(r.bmi).toBeCloseTo(26.45, 1);
  });

  it("BMI 分类边界：18.5 / 25 / 30 临界", () => {
    // 构造身高体重使 BMI 恰落在边界（以 1.70m 计）；目标体重需保持减重目标合法（< 当前）
    const mk = (w: number) =>
      assess({ ...base, heightCm: 170, weightKg: w, targetWeightKg: Math.min(w - 5, 59.9) });
    // BMI = w / 1.7²；18.5*2.89≈53.47、25*2.89≈72.25、30*2.89≈86.7（ bmi 保留两位小数）
    expect(mk(53.4).bmiCategory).toBe("underweight");
    expect(mk(53.5).bmiCategory).toBe("normal");
    expect(mk(72.2).bmiCategory).toBe("normal");
    expect(mk(72.3).bmiCategory).toBe("overweight");
    expect(mk(86.6).bmiCategory).toBe("overweight");
    expect(mk(86.8).bmiCategory).toBe("obese");
  });

  it("BMR 引用年龄中位常量（30-39 → 35 岁），四舍五入取整", () => {
    const r = assess(base);
    const age = AGE_RANGE_MIDPOINT["30-39"];
    // Mifflin 女：10w + 6.25h - 5age - 161
    const expected = Math.round(10 * 72 + 6.25 * 165 - 5 * age - 161);
    expect(r.bmr).toBe(expected);
  });

  it("男性 BMR 比 null 基准高（+5 而非 -161）", () => {
    const r = assess({ ...base, gender: "male" });
    const age = AGE_RANGE_MIDPOINT["30-39"];
    expect(r.bmr).toBe(Math.round(10 * 72 + 6.25 * 165 - 5 * age + 5));
  });

  it("建议摄入 = BMR × 活动系数 + 目标调整（减重 -500）", () => {
    const r = assess(base);
    const age = AGE_RANGE_MIDPOINT["30-39"];
    const bmr = 10 * 72 + 6.25 * 165 - 5 * age - 161;
    const tdee = bmr * 1.375; // light
    const recommended = Math.max(Math.round(tdee - 500), 1200);
    expect(r.recommendedCalories).toBe(recommended);
  });

  it("摄入下限兜底：极端情况不低于 1200", () => {
    // 构造很小的基础代谢：矮、轻、久坐、减重（目标 < 当前，保持合法）
    const r = assess({
      ...base,
      heightCm: 140,
      weightKg: 35,
      targetWeightKg: 32,
      activityFrequency: "sedentary",
    });
    expect(r.recommendedCalories).toBeGreaterThanOrEqual(1200);
  });

  it("增重目标摄入上调（+300）", () => {
    const r = assess({ ...base, goal: "gain_weight", targetWeightKg: 76 });
    const age = AGE_RANGE_MIDPOINT["30-39"];
    const bmr = 10 * 72 + 6.25 * 165 - 5 * age - 161;
    expect(r.recommendedCalories).toBe(Math.round(bmr * 1.375 + 300));
  });

  it("目标日期由差值与周速率推算（减重 0.5kg/周）", () => {
    const r = assess(base); // 12kg / 0.5 = 24 周
    const days = Math.round((new Date(r.targetDate).getTime() - Date.now()) / 86400000);
    expect(days).toBeGreaterThanOrEqual(24 * 7 - 2);
    expect(days).toBeLessThanOrEqual(24 * 7 + 2);
  });

  it("maintain 目标日期为今天且曲线平坦", () => {
    const r = assess({ ...base, goal: "maintain", targetWeightKg: 71.5 });
    expect(new Date(r.targetDate).toDateString()).toBe(new Date().toDateString());
    expect(r.predictionCurve.every((p) => p.weightKg === 71.5)).toBe(true);
  });

  it("预测曲线：从当前体重递减至目标体重，末点=目标（起始点 + 每周一点 = 25 点）", () => {
    const r = assess(base);
    const first = r.predictionCurve[0];
    const last = r.predictionCurve[r.predictionCurve.length - 1];
    expect(first.weightKg).toBeCloseTo(72, 5);
    expect(first.week).toBe(0);
    expect(last.weightKg).toBeCloseTo(60, 5);
    expect(r.predictionCurve.length).toBe(25); // 12kg / 0.5 = 24 周 + 起始点
    // 单调不增
    for (let i = 1; i < r.predictionCurve.length; i++) {
      expect(r.predictionCurve[i].weightKg).toBeLessThanOrEqual(
        r.predictionCurve[i - 1].weightKg
      );
    }
  });

  it("非法输入时 assess 抛错（不返回结果）", () => {
    expect(() => assess({ ...base, heightCm: -5 })).toThrow();
  });
});
