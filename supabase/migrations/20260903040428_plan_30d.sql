-- v2：assessment_result 增加 30 天每日计划（会员核心价值内容）
-- plan_30d 存完整 30 天（含动作/饮食/贴士）；API 层按订阅状态差异化返回：
--   非会员仅拿到 Day1 预览，其余 29 天物理不可见。
-- 计划生成器纯函数（lib/plan/daily.ts），版本随 jsonb 内 version 字段走。

alter table public.assessment_result
  add column if not exists plan_30d jsonb;

comment on column public.assessment_result.plan_30d is
  '30天每日计划：{version, days:[{day, theme, workout{focus,items,minutes}, meals[], tip}]}；完整值入库，脱敏在 API 层';
