/**
 * 订阅闸门与结果脱敏。
 *
 * - isSubscriptionActive：用户级窗口校验（status=active 且 now ∈ [starts_at, expires_at]）。
 *   数据不完整（缺窗口字段）一律不放行——fail-closed。
 * - maskResult：非会员物理上拿不到被保护字段 prediction_curve（直接不出现于响应）。
 */

export interface SubscriptionLike {
  status: string;
  starts_at?: string | null;
  expires_at?: string | null;
}

export function isSubscriptionActive(sub: SubscriptionLike | null | undefined): boolean {
  if (!sub) return false;
  if (sub.status !== "active") return false;
  if (!sub.starts_at || !sub.expires_at) return false;
  const now = Date.now();
  const start = Date.parse(sub.starts_at);
  const end = Date.parse(sub.expires_at);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return now >= start && now <= end;
}

/** 结果中被保护、非会员不可见的字段（assess 结果为 camelCase） */
const PROTECTED_KEYS = ["predictionCurve", "weeklyRateKg"] as const;

export function maskResult<
  T extends Record<string, unknown> & {
    predictionCurve?: unknown;
    weeklyRateKg?: unknown;
  },
>(result: T, unlocked: boolean): { locked: boolean; data: T } {
  if (unlocked) return { locked: false, data: result };
  const data = { ...result };
  for (const k of PROTECTED_KEYS) delete data[k];
  return { locked: true, data };
}
