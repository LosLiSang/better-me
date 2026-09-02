import { describe, it, expect } from "vitest";
import {
  QUIZ_QUESTIONS,
  QUIZ_VERSION,
  REQUIRED_CALC_KEYS,
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

  it("每个选项都有非空 feedback（兜底'忘配文案'）", () => {
    for (const q of QUIZ_QUESTIONS) {
      for (const opt of q.options ?? []) {
        expect(
          opt.feedback,
          `题 ${q.key} 选项 ${opt.value} 缺 feedback`
        ).toBeTruthy();
      }
    }
  });

  it("数字题都有 min/max/unit", () => {
    for (const q of QUIZ_QUESTIONS) {
      if (q.type === "number") {
        expect(q.numeric, `数字题 ${q.key} 缺 numeric`).toBeTruthy();
        expect(Number.isFinite(q.numeric!.min)).toBe(true);
        expect(Number.isFinite(q.numeric!.max)).toBe(true);
        expect(q.numeric!.unit.length).toBeGreaterThan(0);
      }
    }
  });

  it("姓名/年龄/目标/身高/体重/目标体重/运动频率 这些计算 key 都在", () => {
    const keys = new Set(QUIZ_QUESTIONS.map((q) => q.key));
    for (const k of REQUIRED_CALC_KEYS) {
      expect(keys.has(k), `缺少计算 key: ${k}`).toBe(true);
    }
  });

  it("multi 题的 exclusive（none）选项与其它选项互斥，且每题至多一个", () => {
    for (const q of QUIZ_QUESTIONS) {
      if (q.type !== "multi") continue;
      const excl = (q.options ?? []).filter((o) => o.exclusive);
      expect(excl.length, `multi 题 ${q.key} 的 exclusive 数量应≤1`).toBeLessThanOrEqual(1);
      // 若有 exclusive，其它选项不能也带 exclusive
      for (const o of q.options ?? []) {
        if (!o.exclusive) {
          expect(o.exclusive).toBeFalsy();
        }
      }
    }
  });

  it("quizVersion 存在", () => {
    expect(QUIZ_VERSION).toBeTruthy();
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
