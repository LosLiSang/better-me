import { describe, it, expect } from "vitest";
import { deriveCurrentStep } from "./progress";
import { QUIZ_QUESTIONS } from "../quiz/config";

describe("deriveCurrentStep（服务端推导：连续完成的必填步，不信任客户端）", () => {
  it("无答案 → 0", () => {
    expect(deriveCurrentStep(new Set())).toBe(0);
  });

  it("答了第一步必填题 → 1；跳过必填题直接答后面不计入", () => {
    const answered = new Set(["gender"]);
    expect(deriveCurrentStep(answered)).toBe(1);
    // 跳过 age 直接答 goal：连续必填仍只到 gender
    answered.add("goal");
    expect(deriveCurrentStep(answered)).toBe(1);
  });

  it("连续完成前 7 道必填题 → 7", () => {
    const required = QUIZ_QUESTIONS.filter((q) => q.required).map((q) => q.key);
    expect(required.length).toBe(7);
    expect(deriveCurrentStep(new Set(required))).toBe(7);
  });

  it("只答全部可选反馈题 → 0（必填没动）", () => {
    const optional = QUIZ_QUESTIONS.filter((q) => !q.required).map((q) => q.key);
    expect(deriveCurrentStep(new Set(optional))).toBe(0);
  });
});
