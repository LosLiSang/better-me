import { describe, it, expect } from "vitest";
import {
  QUIZ_QUESTIONS,
  QUIZ_VERSION,
  REQUIRED_CALC_KEYS,
  ALL_CALC_KEYS,
  AGE_RANGE_MIDPOINT,
  getQuestion,
} from "./config";

describe("题库结构", () => {
  it("恰好有 33 道题（不含插页）", () => {
    expect(QUIZ_QUESTIONS.length).toBe(33);
  });

  it("所有 key 唯一", () => {
    const keys = QUIZ_QUESTIONS.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("每个选项都有非空 feedback（trim 后非空，兜底'忘配文案'）", () => {
    for (const q of QUIZ_QUESTIONS) {
      for (const opt of q.options ?? []) {
        expect(
          typeof opt.feedback === "string" && opt.feedback.trim().length > 0,
          `题 ${q.key} 选项 ${opt.value} 缺 feedback`
        ).toBe(true);
      }
    }
  });

  it("数字题都有 min/max/unit，且 min < max", () => {
    for (const q of QUIZ_QUESTIONS) {
      if (q.type === "number") {
        expect(q.numeric, `数字题 ${q.key} 缺 numeric`).toBeTruthy();
        expect(Number.isFinite(q.numeric!.min)).toBe(true);
        expect(Number.isFinite(q.numeric!.max)).toBe(true);
        expect(q.numeric!.min, `题 ${q.key} min 应小于 max`).toBeLessThan(q.numeric!.max);
        expect(q.numeric!.unit.length).toBeGreaterThan(0);
      }
    }
  });

  it("必填计算 key 的期望集合 = {gender,age,goal,height,weight,target_weight,activity_frequency}", () => {
    expect([...REQUIRED_CALC_KEYS].sort()).toEqual(
      [
        "activity_frequency",
        "age",
        "gender",
        "goal",
        "height",
        "target_weight",
        "weight",
      ].sort()
    );
  });

  it("双向一致性：REQUIRED ⊆ ALL_CALC，且 ALL_CALC 全部 forCalculation=true", () => {
    const byKey = new Map(QUIZ_QUESTIONS.map((q) => [q.key, q]));
    for (const k of ALL_CALC_KEYS) {
      expect(byKey.get(k)!.forCalculation, `题 ${k} 标记为计算题`).toBe(true);
    }
    for (const k of REQUIRED_CALC_KEYS) {
      expect(ALL_CALC_KEYS).toContain(k);
      expect(byKey.get(k)!.required, `计算题 ${k} 应必填`).toBe(true);
    }
  });

  it("multi 题的 exclusive 选项至多一个；有 exclusive 时须还有普通选项", () => {
    for (const q of QUIZ_QUESTIONS) {
      if (q.type !== "multi") continue;
      const opts = q.options ?? [];
      const excl = opts.filter((o) => o.exclusive);
      expect(excl.length, `multi 题 ${q.key} 的 exclusive 数量应≤1`).toBeLessThanOrEqual(1);
      if (excl.length === 1) {
        expect(
          opts.length,
          `multi 题 ${q.key} 有 exclusive 时应还有普通选项`
        ).toBeGreaterThan(1);
      }
    }
  });

  it("single/likert 题不应有 exclusive 标记", () => {
    for (const q of QUIZ_QUESTIONS) {
      if (q.type === "multi" || q.type === "number") continue;
      for (const o of q.options ?? []) {
        expect(o.exclusive, `题 ${q.key} 选项 ${o.value} 不应有 exclusive`).toBeFalsy();
      }
    }
  });

  it("形状一致性：number 题无 options，选项题无 numeric", () => {
    for (const q of QUIZ_QUESTIONS) {
      if (q.type === "number") {
        expect(q.options, `数字题 ${q.key} 不应有 options`).toBeUndefined();
      } else {
        expect(q.numeric, `选项题 ${q.key} 不应有 numeric`).toBeUndefined();
        expect((q.options ?? []).length, `题 ${q.key} 应有选项`).toBeGreaterThan(0);
      }
    }
  });

  it("quizVersion 存在", () => {
    expect(QUIZ_VERSION).toBeTruthy();
  });

  it("年龄档位都有中位岁数映射（BMR 计算依赖）", () => {
    const ageQ = getQuestion("age")!;
    for (const o of ageQ.options ?? []) {
      expect(
        Number.isFinite(AGE_RANGE_MIDPOINT[o.value]),
        `年龄档 ${o.value} 缺中位岁数映射`
      ).toBe(true);
    }
  });

  it("getQuestion 能按 key 取到题目", () => {
    const q = getQuestion("height");
    expect(q).toBeTruthy();
    expect(q!.type).toBe("number");
  });

  it("单选/多选/likert 题的选项 value 唯一", () => {
    for (const q of QUIZ_QUESTIONS) {
      if (q.type === "number") continue;
      const values = (q.options ?? []).map((o) => o.value);
      expect(new Set(values).size, `题 ${q.key} 选项 value 重复`).toBe(values.length);
    }
  });
});
