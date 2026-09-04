import { describe, it, expect } from "vitest";
import { validateAnswerValue } from "./validate-answer";

describe("validateAnswerValue（按题库配置校验答案形态）", () => {
  it("single：合法选项通过；非法选项/多值拒绝", () => {
    expect(validateAnswerValue("gender", { value: "male" })).toEqual([]);
    expect(validateAnswerValue("gender", { value: "robot" }).length).toBeGreaterThan(0);
    expect(validateAnswerValue("gender", { values: ["male"] }).length).toBeGreaterThan(0);
  });

  it("likert：按选项 value 校验", () => {
    expect(validateAnswerValue("emotional_eating", { value: "3" })).toEqual([]);
    expect(validateAnswerValue("emotional_eating", { value: "9" }).length).toBeGreaterThan(0);
  });

  it("number：数值在题库 min/max 内通过；越界/非数值拒绝", () => {
    expect(validateAnswerValue("height", { value: 170 })).toEqual([]);
    expect(validateAnswerValue("height", { value: 99 }).length).toBeGreaterThan(0);
    expect(validateAnswerValue("height", { value: 251 }).length).toBeGreaterThan(0);
    expect(validateAnswerValue("height", { value: "170" }).length).toBeGreaterThan(0);
  });

  it("multi：合法多值通过；含未知值拒绝", () => {
    expect(
      validateAnswerValue("other_goals", { values: ["muscle", "posture"] })
    ).toEqual([]);
    expect(
      validateAnswerValue("other_goals", { values: ["muscle", "hacker"] }).length
    ).toBeGreaterThan(0);
    expect(validateAnswerValue("other_goals", { value: "muscle" }).length).toBeGreaterThan(0);
  });

  it("multi 互斥：none 与其它选项同选拒绝", () => {
    expect(
      validateAnswerValue("other_goals", { values: ["muscle", "none"] }).length
    ).toBeGreaterThan(0);
    expect(validateAnswerValue("other_goals", { values: ["none"] })).toEqual([]);
  });

  it("multi 空数组拒绝（至少选一个）", () => {
    expect(validateAnswerValue("other_goals", { values: [] }).length).toBeGreaterThan(0);
  });

  it("未知 stepKey 拒绝", () => {
    expect(validateAnswerValue("not_a_step", { value: "x" }).length).toBeGreaterThan(0);
  });

  it("answer_value 缺失形态拒绝", () => {
    expect(validateAnswerValue("gender", {}).length).toBeGreaterThan(0);
    expect(validateAnswerValue("gender", null as never).length).toBeGreaterThan(0);
  });
});

import { crossValidateAnswer } from "./validate-answer";

describe("crossValidateAnswer（与已存答案交叉校验）", () => {
  const saved = {
    goal: { value: "lose_weight" },
    weight: { value: 72 },
  };

  it("减重目标 90 > 当前 72 → 拒绝", () => {
    expect(crossValidateAnswer("target_weight", { value: 90 }, saved).length).toBeGreaterThan(0);
  });

  it("减重目标 65 < 当前 → 通过", () => {
    expect(crossValidateAnswer("target_weight", { value: 65 }, saved)).toEqual([]);
  });

  it("增重目标 76 > 当前 → 通过；60 < 当前 → 拒绝", () => {
    const s2 = { ...saved, goal: { value: "gain_weight" } };
    expect(crossValidateAnswer("target_weight", { value: 76 }, s2)).toEqual([]);
    expect(crossValidateAnswer("target_weight", { value: 60 }, s2).length).toBeGreaterThan(0);
  });

  it("maintain 容差 ±10：80 通过、83 拒绝", () => {
    const s3 = { ...saved, goal: { value: "maintain" } };
    expect(crossValidateAnswer("target_weight", { value: 80 }, s3)).toEqual([]);
    expect(crossValidateAnswer("target_weight", { value: 83 }, s3).length).toBeGreaterThan(0);
  });

  it("依赖字段尚未提交 → 不交叉校验（通过，留给 complete 兜底）", () => {
    expect(crossValidateAnswer("target_weight", { value: 90 }, {})).toEqual([]);
  });

  it("反向：后改 goal 与已存 target_weight 冲突 → 拒绝", () => {
    const saved2 = { weight: { value: 72 }, target_weight: { value: 65 } };
    expect(crossValidateAnswer("goal", { value: "gain_weight" }, saved2).length).toBeGreaterThan(0);
    expect(crossValidateAnswer("goal", { value: "lose_weight" }, saved2)).toEqual([]);
  });

  it("反向：goal=maintain 与已存 target_weight 相差 >10 → 拒绝", () => {
    const saved3 = { weight: { value: 72 }, target_weight: { value: 83 } };
    expect(crossValidateAnswer("goal", { value: "maintain" }, saved3).length).toBeGreaterThan(0);
    expect(crossValidateAnswer("goal", { value: "maintain" }, { weight: { value: 72 }, target_weight: { value: 80 } })).toEqual([]);
  });
});
