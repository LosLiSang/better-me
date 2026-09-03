import { describe, it, expect } from "vitest";
import { isSubscriptionActive, maskResult } from "./gate";

const ACTIVE = {
  status: "active" as const,
  starts_at: new Date(Date.now() - 86400000).toISOString(),
  expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
};

const EXPIRED = {
  status: "active" as const,
  starts_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  expires_at: new Date(Date.now() - 86400000).toISOString(),
};

describe("isSubscriptionActive（用户级窗口校验）", () => {
  it("无订阅记录 → false", () => {
    expect(isSubscriptionActive(null)).toBe(false);
  });

  it("inactive → false", () => {
    expect(isSubscriptionActive({ ...ACTIVE, status: "inactive" as const })).toBe(false);
  });

  it("窗口内 active → true", () => {
    expect(isSubscriptionActive(ACTIVE)).toBe(true);
  });

  it("已过期 → false", () => {
    expect(isSubscriptionActive(EXPIRED)).toBe(false);
  });

  it("starts_at 在未来 → false（未生效）", () => {
    expect(
      isSubscriptionActive({
        ...ACTIVE,
        starts_at: new Date(Date.now() + 86400000).toISOString(),
      })
    ).toBe(false);
  });

  it("缺 starts_at/expires_at → false（数据不完整不放行）", () => {
    expect(isSubscriptionActive({ status: "active" as const })).toBe(false);
  });
});

describe("maskResult（非会员脱敏：拿不到被保护字段）", () => {
  const full = {
    bmi: 26.45,
    bmiCategory: "overweight",
    recommendedCalories: 1600,
    targetDate: "2027-03-03",
    predictionCurve: [
      { week: 0, weightKg: 72 },
      { week: 1, weightKg: 71.5 },
    ],
    weeklyRateKg: -0.5,
  };

  it("非会员：predictionCurve/weeklyRateKg 被移除 + locked:true，非敏感字段保留", () => {
    const m = maskResult(full, false);
    expect(m.locked).toBe(true);
    expect("predictionCurve" in m.data).toBe(false);
    expect("weeklyRateKg" in m.data).toBe(false);
    expect(m.data.bmi).toBe(26.45);
    expect(m.data.bmiCategory).toBe("overweight");
    expect(m.data.recommendedCalories).toBe(1600);
    expect(m.data.targetDate).toBe("2027-03-03");
  });

  it("会员：完整数据 + locked:false", () => {
    const m = maskResult(full, true);
    expect(m.locked).toBe(false);
    expect(m.data.predictionCurve).toEqual(full.predictionCurve);
    expect(m.data.weeklyRateKg).toBe(-0.5);
  });
});
