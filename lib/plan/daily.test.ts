import { describe, it, expect } from "vitest";
import { generateMonthPlan, PLAN_VERSION, type PlanInput } from "./daily";

const base: PlanInput = {
  core: {
    gender: "female",
    ageBand: "30-39",
    goal: "lose_weight",
    heightCm: 165,
    weightKg: 72,
    targetWeightKg: 65,
    activityFrequency: "light",
  },
  calories: 1450,
  extras: {
    discomforts: [],
    injuries: [],
    dietType: "traditional",
    mealsPerDay: "3",
    cravings: [],
    exerciseTime: "20_40",
    desiredFreq: "3_5",
  },
};

describe("generateMonthPlan（30 天每日计划）", () => {
  it("恰好 30 天，day 从 1 连续编号到 30", () => {
    const p = generateMonthPlan(base);
    expect(p.version).toBe(PLAN_VERSION);
    expect(p.days.length).toBe(30);
    expect(p.days.map((d) => d.day)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("每天结构完整：主题/动作/三餐/贴士非空", () => {
    const p = generateMonthPlan(base);
    for (const d of p.days) {
      expect(d.theme.trim().length).toBeGreaterThan(0);
      expect(d.workout.focus.trim().length).toBeGreaterThan(0);
      expect(d.workout.items.length).toBeGreaterThan(0);
      expect(d.workout.minutes).toBeGreaterThan(0);
      expect(d.meals.length).toBeGreaterThanOrEqual(3);
      for (const m of d.meals) {
        expect(m.desc.trim().length).toBeGreaterThan(0);
        expect(m.kcal).toBeGreaterThan(0);
      }
      expect(d.tip.trim().length).toBeGreaterThan(0);
    }
  });

  it("每日热量总和 ≈ 目标热量（±15%）", () => {
    const p = generateMonthPlan(base);
    for (const d of p.days) {
      const sum = d.meals.reduce((s, m) => s + m.kcal, 0);
      expect(Math.abs(sum - base.calories) / base.calories).toBeLessThan(0.15);
    }
  });

  it("确定性：同输入两次生成完全一致（可测试/可重现）", () => {
    expect(generateMonthPlan(base)).toEqual(generateMonthPlan(base));
  });

  it("膝伤史：30 天动作中不出现深蹲跳/跳绳/弓步跳等高冲击项", () => {
    const p = generateMonthPlan({ ...base, extras: { ...base.extras, injuries: ["knee"] } });
    const banned = /深蹲跳|跳绳|弓步跳|波比跳|开合跳|登山跑|高抬腿/;
    for (const d of p.days) {
      for (const item of d.workout.items) {
        expect(item, `Day${d.day}: ${item}`).not.toMatch(banned);
      }
    }
  });

  it("腰背不适：避开硬拉/早安式体前屈等脊柱负荷项", () => {
    const p = generateMonthPlan({ ...base, extras: { ...base.extras, discomforts: ["back"] } });
    const banned = /硬拉|体前屈|仰卧起坐/;
    for (const d of p.days) {
      for (const item of d.workout.items) expect(item).not.toMatch(banned);
    }
  });

  it("素食：三餐不出现肉类描述；生酮：不出现米饭/面条/面包", () => {
    const vegan = generateMonthPlan({ ...base, extras: { ...base.extras, dietType: "vegan" } });
    for (const d of vegan.days)
      for (const m of d.meals) expect(m.desc).not.toMatch(/鸡胸|牛肉|三文鱼|虾仁|瘦猪/);

    const keto = generateMonthPlan({ ...base, extras: { ...base.extras, dietType: "keto" } });
    for (const d of keto.days)
      for (const m of d.meals) expect(m.desc).not.toMatch(/米饭|面条|面包|燕麦|红薯/);
  });

  it("期望频率低（1-3次/周）：每周至少 3 个休息日（恢复主题）", () => {
    const p = generateMonthPlan({ ...base, extras: { ...base.extras, desiredFreq: "1_3" } });
    for (let w = 0; w < 4; w++) {
      const week = p.days.slice(w * 7, w * 7 + 7);
      const rest = week.filter((d) => d.workout.focus === "恢复日");
      expect(rest.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("运动时长档位决定动作分钟数上限", () => {
    const p = generateMonthPlan({ ...base, extras: { ...base.extras, exerciseTime: "10_20" } });
    for (const d of p.days) expect(d.workout.minutes).toBeLessThanOrEqual(20);
  });

  it("维持目标（maintain）：也能生成 30 天保持计划", () => {
    const p = generateMonthPlan({
      ...base,
      core: { ...base.core, goal: "maintain", targetWeightKg: 71.5 },
    });
    expect(p.days.length).toBe(30);
  });

  it("计划随周递进：后两周强度标签比第一周多（进阶感）", () => {
    const p = generateMonthPlan(base);
    const lv = (s: string) => (s.includes("进阶") ? 1 : 0);
    const w1 = p.days.slice(0, 7).reduce((s, d) => s + lv(d.theme), 0);
    const w34 = p.days.slice(14).reduce((s, d) => s + lv(d.theme), 0);
    expect(w34).toBeGreaterThan(w1);
  });
});
