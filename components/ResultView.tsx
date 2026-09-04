"use client";

/**
 * 结果视图（被「我的计划」Tab 与 /results 跳转页共用）：
 * - 曲线：面积填充 + 每周里程碑点 + 起止体重标注；退化情形（点数<2）降级为摘要卡
 * - 30 天每日计划：会员全量（周切换 + 日卡）；非会员仅 Day1 + 锁定格
 * - 付费卡（整洁笔记版）：升级 → 模拟支付 → 解锁
 * - 「再写一份」：清本地 sessionId 重开新手账
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PaperCard, SketchButton, Marker } from "@/components/sketch";
import { getSupabaseBrowserClient, clearStoredSessionId, storeSessionId } from "@/lib/supabase/client";

export interface CurvePoint {
  week: number;
  weightKg: number;
}
interface DayPlanUI {
  day: number;
  theme: string;
  workout: { focus: string; items: string[]; minutes: number };
  meals: { meal: string; desc: string; kcal: number }[];
  tip: string;
}
interface ResultPayload {
  locked: boolean;
  data: {
    bmi?: number;
    bmiCategory?: string;
    recommendedCalories?: number;
    targetDate?: string;
    predictionCurve?: CurvePoint[];
    weeklyRateKg?: number;
    plan?: { totalDays: number; previewDays: DayPlanUI[] } | null;
  };
  subscription?: { status: string; expiresAt?: string };
  error?: string;
}

const BMI_CN: Record<string, string> = {
  underweight: "偏瘦",
  normal: "正常",
  overweight: "偏重",
  obese: "肥胖",
};

/** 手绘曲线：面积 + 里程碑点 + 起止标注（点数<2 由调用方降级） */
export function CurveChart({ curve }: { curve: CurvePoint[] }) {
  const w = 340;
  const h = 150;
  const pad = 26;
  // 采样：点多于 40 时按步长抽稀（超长周期只取前 40 点展示第一年）
  const sampled = curve.length > 40 ? curve.filter((_, i) => i % Math.ceil(curve.length / 40) === 0 || i === curve.length - 1) : curve;
  const xs = sampled.map((p) => p.week);
  const ys = sampled.map((p) => p.weightKg);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs, minX + 1);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = Math.max(maxY - minY, 0.5);
  const px = (wk: number) => pad + ((wk - minX) / (maxX - minX)) * (w - pad * 2);
  const py = (kg: number) => h - pad - ((kg - (minY - 0.5)) / (spanY + 1)) * (h - pad * 2);
  const line = sampled.map((p) => `${px(p.week).toFixed(1)},${py(p.weightKg).toFixed(1)}`).join(" ");
  const area = `${px(sampled[0].week)},${h - pad} ${line} ${px(sampled[sampled.length - 1].week)},${h - pad}`;

  // 里程碑：每 N 周取一个点（≤6 个）
  const step = Math.max(1, Math.floor((maxX - minX) / 5));
  const marks = sampled.filter((p) => p.week % step === 0 || p.week === maxX);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full draw-in" style={{ ["--dash" as string]: 1200 }}>
      <polygon points={area} fill="var(--color-sky-soft)" opacity="0.45" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-sky-deep)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {marks.map((m) => (
        <g key={m.week}>
          <circle cx={px(m.week)} cy={py(m.weightKg)} r="4" fill="white" stroke="var(--color-ink)" strokeWidth="2" />
          <text x={px(m.week)} y={py(m.weightKg) - 8} fontSize="10" textAnchor="middle" fill="var(--color-pencil)">
            {m.weightKg.toFixed(0)}
          </text>
        </g>
      ))}
      <text x={pad} y={14} fontSize="12" fill="var(--color-pencil)">
        起点 {ys[0].toFixed(1)} kg
      </text>
      <text x={w - pad} y={14} fontSize="12" textAnchor="end" fill="var(--color-accent)" fontWeight="bold">
        目标 {ys[ys.length - 1].toFixed(1)} kg
      </text>
      <text x={pad} y={h - 6} fontSize="11" fill="var(--color-pencil)">
        第 {minX} 周
      </text>
      <text x={w - pad} y={h - 6} fontSize="11" textAnchor="end" fill="var(--color-pencil)">
        第 {maxX} 周{curve.length > 40 ? "（展示第一年）" : ""}
      </text>
    </svg>
  );
}

function LockedCurve() {
  return (
    <svg viewBox="0 0 340 150" className="w-full">
      <path
        d="M26 120 C 70 30, 120 110, 170 60 S 280 90, 314 40"
        fill="none"
        stroke="var(--color-pencil-light)"
        strokeWidth="2.5"
        strokeDasharray="8 7"
      />
      <text x="125" y="80" fontSize="15" fill="var(--color-pencil)" transform="rotate(-6 170 75)">
        🔒 解锁后显示完整曲线
      </text>
    </svg>
  );
}

/** 30 天计划区：会员全量 / 非会员 Day1 + 锁定格 */
function MonthPlanSection({
  plan,
  locked,
}: {
  plan: { totalDays: number; previewDays: DayPlanUI[] } | null;
  locked: boolean;
}) {
  const [week, setWeek] = useState(0);
  if (!plan) return null;
  const days = plan.previewDays;

  return (
    <PaperCard className="p-5" tilt={1}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold">📅 30 天每日计划</p>
        {!locked && (
          <span className="text-xs text-[var(--color-pencil)]">
            动作 + 三餐 + 贴士，每天都不一样
          </span>
        )}
      </div>

      {/* 周切换 */}
      <div className="flex gap-2 mb-4">
        {[0, 1, 2, 3].map((wk) => (
          <button
            key={wk}
            type="button"
            onClick={() => setWeek(wk)}
            className={`px-3 py-1 sketch-border-sm text-sm transition-colors ${
              week === wk
                ? "bg-[var(--color-marker)]/60 font-bold"
                : "bg-white/70 hover:bg-[var(--color-sky-soft)]/50"
            }`}
          >
            第 {wk + 1} 周
          </button>
        ))}
      </div>

      {locked ? (
        /* 非会员：Day1 预览 + 其余锁定格 */
        <div>
          <DayCard d={days[0]} />
          <div className="grid grid-cols-6 gap-2 mt-3">
            {Array.from({ length: 29 }, (_, i) => (
              <div
                key={i}
                className="h-9 grid place-items-center bg-white/50 sketch-border-sm text-sm text-[var(--color-pencil-light)]"
                title="解锁后可见"
              >
                🔒
              </div>
            ))}
          </div>
          <p className="text-center text-sm mt-3 text-[var(--color-accent)] font-bold">
            剩下 29 天的详细安排，解锁后全部是你的
          </p>
        </div>
      ) : (
        /* 会员：当周 7 天（最后一段 2 天） */
        <div className="space-y-3">
          {days.slice(week * 7, week * 7 + 7).map((d) => (
            <DayCard key={d.day} d={d} />
          ))}
        </div>
      )}
    </PaperCard>
  );
}

function DayCard({ d }: { d: DayPlanUI }) {
  return (
    <div className="fade-up bg-white/70 sketch-border-sm tilt-3 p-3">
      <div className="flex items-center justify-between">
        <p className="font-bold">Day {d.day} · <span className="text-sm font-normal text-[var(--color-pencil)]">{d.theme}</span></p>
        <span className="digits text-lg">{d.workout.minutes}′</span>
      </div>
      <p className="text-sm mt-1">
        <span className="marker-yellow">{d.workout.focus}</span>
        <span className="text-[var(--color-pencil)]">｜{d.workout.items.join("，")}</span>
      </p>
      <div className="flex flex-wrap gap-2 mt-2">
        {d.meals.map((m, i) => (
          <span key={i} className="text-xs bg-[var(--color-sun-soft)]/70 px-2 py-0.5 sketch-border-sm">
            {m.meal}：{m.desc}（<span className="digits">{m.kcal}</span> kcal）
          </span>
        ))}
      </div>
      <p className="text-xs text-[var(--color-pencil)] mt-1.5">💡 {d.tip}</p>
    </div>
  );
}

export default function ResultView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [payMsg, setPayMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const r = await fetch(`/api/session/${sessionId}/result`);
    const j = (await r.json()) as ResultPayload;
    if (r.ok) setResult(j);
    else setErr(j.error ?? "加载失败");
  }, [sessionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载时数据获取，setState 均发生在 await 之后
    load();
  }, [load]);

  async function upgradeAndPay() {
    setBusy(true);
    setPayMsg("");
    try {
      const sb = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (user?.email) {
        const { error: lErr } = await sb.auth.signInWithPassword({ email, password: pwd });
        if (lErr) throw new Error(lErr.message);
      } else {
        const r1 = await fetch("/api/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pwd }),
        });
        if (r1.status === 400) {
          const { error: lErr } = await sb.auth.signInWithPassword({ email, password: pwd });
          if (lErr) throw new Error("该邮箱已有账号，请输入正确密码登录");
        } else if (!r1.ok) {
          const j = (await r1.json()) as { message?: string };
          throw new Error(j.message ?? "升级失败");
        }
      }
      const r2 = await fetch("/api/pay", { method: "POST" });
      if (!r2.ok) {
        const j = (await r2.json()) as { message?: string };
        throw new Error(j.message ?? "支付失败");
      }
      setPayMsg("支付成功，正在解锁完整方案…");
      await load();
    } catch (e) {
      setPayMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** 再写一份：清本地会话 → 新手账（同用户新会话） */
  async function rewrite() {
    try {
      const r = await fetch("/api/session", { method: "POST" });
      if (r.ok) {
        const { sessionId: sid } = (await r.json()) as { sessionId: string };
        storeSessionId(sid);
        router.push(`/onboarding`);
        return;
      }
    } catch {
      /* 下方兜底 */
    }
    clearStoredSessionId();
    router.push("/onboarding");
  }

  if (err && !result)
    return (
      <PaperCard className="p-8 text-center" tilt={2}>
        <p>{err}</p>
        <p className="mt-3">
          <a href="/onboarding" className="underline-sketch">← 回到手账</a>
        </p>
      </PaperCard>
    );

  if (!result)
    return (
      <PaperCard className="p-8" tilt={1}><p>正在翻开结果页…</p></PaperCard>
    );

  const d = result.data;
  const locked = result.locked;
  const curve = d.predictionCurve ?? [];
  const maintain = curve.length >= 2 && curve[0].week === curve[curve.length - 1].week;

  return (
    <div className="space-y-5">
      <div className="text-center pt-4">
        <p className="text-sm tracking-widest text-[var(--color-pencil)]">你的健康手账 · 我的计划</p>
        <h1 className="text-3xl font-bold mt-1">
          {locked ? <>这是你的 <Marker>免费预览</Marker></> : <>完整方案已解锁 🎉</>}
        </h1>
      </div>

      {/* 指标卡 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "BMI", value: d.bmi?.toFixed(1), sub: BMI_CN[d.bmiCategory ?? ""] ?? "" },
          { label: "每日建议", value: d.recommendedCalories, sub: "kcal" },
          {
            label: "目标达成",
            value: maintain ? "保持计划" : d.targetDate,
            sub: maintain ? "维持当前状态" : "预计日期",
            small: true,
          },
        ].map((m, i) => (
          <PaperCard key={m.label} className="p-4 text-center" tilt={((i % 3) + 1) as 1 | 2 | 3}>
            <p className="text-xs text-[var(--color-pencil)]">{m.label}</p>
            <p className={`digits ${m.small ? "text-2xl" : "text-3xl"} ${i === 0 ? "text-[var(--color-accent)]" : ""}`}>
              {m.value ?? "—"}
            </p>
            <p className="text-xs text-[var(--color-pencil)]">{m.sub}</p>
          </PaperCard>
        ))}
      </div>

      {/* 曲线卡：退化情形（<2 点，如 maintain 单点）显示摘要而非破图 */}
      <PaperCard className="p-5" tilt={2}>
        <p className="font-bold mb-2">
          体重预测曲线 {locked && <span className="text-xs text-[var(--color-pencil)]">（会员可见）</span>}
        </p>
        {locked ? (
          <LockedCurve />
        ) : curve.length < 2 ? (
          <p className="text-sm text-[var(--color-pencil)] py-4 text-center">
            当前体重与目标一致，进入 <Marker>保持计划</Marker>——重点是稳住，曲线保持水平就是胜利。
          </p>
        ) : (
          <CurveChart curve={curve} />
        )}
        {!locked && typeof d.weeklyRateKg === "number" && !maintain && (
          <p className="text-sm text-[var(--color-pencil)] mt-1">
            计划速率：<Marker>{d.weeklyRateKg > 0 ? "+" : ""}{d.weeklyRateKg} kg/周</Marker>
          </p>
        )}
      </PaperCard>

      {/* 30 天计划 */}
      <MonthPlanSection plan={d.plan ?? null} locked={locked} />

      {/* 付费卡（整洁笔记版） */}
      {locked && (
        <PaperCard className="p-6" tilt={1} tidy>
          <h2 className="text-xl font-bold">解锁完整方案</h2>
          <ul className="text-sm text-[var(--color-pencil)] mt-2 space-y-1 list-disc list-inside">
            <li>完整体重预测曲线与每周速率</li>
            <li>30 天每日计划：每天练什么、吃什么，全部安排好</li>
            <li>会员期内所有报告无限查看</li>
            <li>演示模拟支付，即刻生效 30 天</li>
          </ul>
          <div className="mt-4 space-y-2.5">
            <input
              type="email"
              placeholder="邮箱（用于找回你的会员）"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white sketch-border-tidy outline-none focus:border-[var(--color-sky-deep)]"
            />
            <input
              type="password"
              placeholder="设置密码（≥6 位）"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="w-full px-3 py-2 bg-white sketch-border-tidy outline-none focus:border-[var(--color-sky-deep)]"
            />
            <SketchButton tone="accent" disabled={busy || !email || pwd.length < 6} onClick={upgradeAndPay}>
              {busy ? "处理中…" : "升级并解锁（模拟支付 ¥9.9）"}
            </SketchButton>
            {payMsg && <p className="text-sm fade-up">{payMsg}</p>}
            <p className="text-xs text-[var(--color-pencil-light)]">
              演示环境不产生真实扣款；已有账号的邮箱会要求输入原密码登录。
            </p>
          </div>
        </PaperCard>
      )}

      {result.subscription?.status === "active" && (
        <p className="text-center text-sm text-[var(--color-pencil)]">
          会员有效期至 <Marker>{(result.subscription.expiresAt ?? "").slice(0, 10)}</Marker>
        </p>
      )}

      {/* 再写一份 */}
      <div className="text-center pb-8">
        <SketchButton onClick={rewrite}>✏️ 再写一份（重新测评）</SketchButton>
        <p className="text-xs text-[var(--color-pencil-light)] mt-2">
          用最新状态重新计算，旧报告仍保留在你的会员里
        </p>
      </div>
    </div>
  );
}
