-- 初始 Schema（v1）：4 张业务表 + RLS + 约束
-- 设计依据：doc/架构设计.md §2
-- 要点：
--   * 用户身份 = Supabase auth.users（含匿名用户），业务表 user_id 直接外键引用，不建业务用户表
--   * assessment_answer 用 UNIQUE(session_id, step_key) 实现分步保存幂等（重复提交 = update）
--   * subscription 用户级（user_id UNIQUE），[starts_at, expires_at] 窗口有效，payment_event_id 唯一保幂等
--   * 全表启用 RLS，按 auth.uid() 隔离

-- ── 测评会话（核心聚合根） ────────────────────────────────────────
create table public.assessment_session (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'in_progress'
                check (status in ('in_progress', 'completed')),
  current_step  int  not null default 0,
  quiz_version  text not null,
  started_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.assessment_session is
  '一次问卷流会话；current_step 由服务端按连续完成的必填步推导，不信任客户端';

-- ── 分步答案（jsonb 灵活存单选/多选/数值；UNIQUE 保证幂等） ───────
create table public.assessment_answer (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.assessment_session (id) on delete cascade,
  step_key     text not null,
  answer_value jsonb not null,
  answered_at  timestamptz not null default now(),
  unique (session_id, step_key)
);

create index idx_answer_session on public.assessment_answer (session_id);

-- ── 计算结果（1:1 会话；显式列存计算值；prediction_curve 存完整值，脱敏在 API 层） ──
create table public.assessment_result (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null unique references public.assessment_session (id) on delete cascade,
  bmi                  numeric(5, 2) not null,
  bmi_category         text not null
                       check (bmi_category in ('underweight', 'normal', 'overweight', 'obese')),
  recommended_calories int not null,
  target_date          date,
  prediction_curve     jsonb not null,
  algorithm_version    text not null,
  calculated_at        timestamptz not null default now()
);

-- ── 订阅（用户级天数制；窗口内该用户所有会话结果解锁） ───────────
create table public.subscription (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references auth.users (id) on delete cascade,
  status           text not null default 'inactive'
                   check (status in ('inactive', 'active')),
  starts_at        timestamptz,
  expires_at       timestamptz,
  payment_event_id text unique,
  paid_at          timestamptz,
  amount           numeric(10, 2)
);

-- ── updated_at 自动维护 ─────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_session_touch
  before update on public.assessment_session
  for each row execute function public.touch_updated_at();

-- ── RLS：按 auth.uid() 隔离 ─────────────────────────────────────
alter table public.assessment_session enable row level security;
alter table public.assessment_answer   enable row level security;
alter table public.assessment_result   enable row level security;
alter table public.subscription        enable row level security;

create policy "session_owner_all" on public.assessment_session
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "answer_via_session_owner" on public.assessment_answer
  for all
  using (
    exists (
      select 1 from public.assessment_session s
      where s.id = session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assessment_session s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "result_via_session_owner" on public.assessment_result
  for all
  using (
    exists (
      select 1 from public.assessment_session s
      where s.id = session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assessment_session s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "subscription_owner_all" on public.subscription
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
