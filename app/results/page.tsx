"use client";

/**
 * 结果页：
 * - locked:true → BMI 等非敏感指标可见 + 曲线区画"待解锁"虚线 + 整洁笔记版付费卡
 * - locked:false → 手绘预测曲线 draw-in + 完整指标
 * 付费卡内：先升级（邮箱+密码）→ 模拟支付 → 完成后刷新结果
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PaperCard, SketchButton, Marker } from "@/components/sketch";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface CurvePoint {
  week: number;
  weightKg: number;
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

function CurveChart({ curve }: { curve: CurvePoint[] }) {
  const w = 320;
  const h = 140;
  const pad = 18;
  const xs = curve.map((p) => p.week);
  const ys = curve.map((p) => p.weightKg);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs, minX + 1);
  const minY = Math.min(...ys) - 1;
  const maxY = Math.max(...ys) + 1;
  const pts = curve.map((p) => {
    const x = pad + ((p.week - minX) / (maxX - minX)) * (w - pad * 2);
    const y = h - pad - ((p.weightKg - minY) / (maxY - minY)) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full draw-in" style={{ ["--dash" as string]: 900 }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--color-sky-deep)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x={pad} y={pad} fontSize="11" fill="var(--color-pencil)">
        {maxY.toFixed(0)} kg
      </text>
      <text x={pad} y={h - 4} fontSize="11" fill="var(--color-pencil)">
        第 {minX} 周 → 第 {maxX} 周
      </text>
    </svg>
  );
}

function LockedCurve() {
  return (
    <svg viewBox="0 0 320 140" className="w-full">
      <path
        d="M18 120 C 60 30, 110 110, 160 60 S 260 90, 302 40"
        fill="none"
        stroke="var(--color-pencil-light)"
        strokeWidth="2"
        strokeDasharray="7 6"
      />
      <text x="118" y="76" fontSize="14" fill="var(--color-pencil)" transform="rotate(-6 160 70)">
        🔒 完整曲线在这里
      </text>
    </svg>
  );
}

function Results() {
  const sp = useSearchParams();
  const sessionId = sp.get("session") ?? "";
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
      // 已是正式账号（重访用户）则 upgrade 会失败 email_taken —— 先尝试登录态判断
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (user?.email) {
        // 已是正式账号：直接登录该邮箱密码（换设备场景）
        const { error: lErr } = await sb.auth.signInWithPassword({ email, password: pwd });
        if (lErr) throw new Error(lErr.message);
      } else {
        const r1 = await fetch("/api/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pwd }),
        });
        if (r1.status === 400) {
          // 邮箱已被注册 → 走登录认领（已有账号仅登录，不做合并）
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

  if (err && !result)
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <PaperCard className="p-8 text-center" tilt={2}>
          <p>{err || "缺少会话参数，请从问卷进入"}</p>
          <p className="mt-3">
            <a href="/onboarding" className="underline-sketch">← 回到手账</a>
          </p>
        </PaperCard>
      </main>
    );

  if (!sessionId)
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <PaperCard className="p-8 text-center" tilt={2}>
          <p>缺少会话参数，请从问卷进入</p>
          <p className="mt-3">
            <a href="/onboarding" className="underline-sketch">← 回到手账</a>
          </p>
        </PaperCard>
      </main>
    );

  if (!result)
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <PaperCard className="p-8" tilt={1}><p>正在翻开结果页…</p></PaperCard>
      </main>
    );

  const d = result.data;
  const locked = result.locked;

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="text-center pt-4">
          <p className="text-sm tracking-widest text-[var(--color-pencil)]">你的健康手账 · 结果页</p>
          <h1 className="text-3xl font-bold mt-1">
            {locked ? <>这是你的 <Marker>免费预览</Marker></> : <>完整方案已解锁 🎉</>}
          </h1>
        </div>

        {/* 指标卡 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "BMI", value: d.bmi?.toFixed(1), sub: BMI_CN[d.bmiCategory ?? ""] ?? "" },
            { label: "每日建议", value: d.recommendedCalories, sub: "kcal" },
            { label: "目标达成", value: d.targetDate, sub: "预计日期", small: true },
          ].map((m, i) => (
            <PaperCard key={m.label} className="p-4 text-center" tilt={((i % 3) + 1) as 1 | 2 | 3}>
              <p className="text-xs text-[var(--color-pencil)]">{m.label}</p>
              <p className={`digits text-3xl ${i === 0 ? "text-[var(--color-accent)]" : ""}`}>
                {m.value ?? "—"}
              </p>
              <p className="text-xs text-[var(--color-pencil)]">{m.sub}</p>
            </PaperCard>
          ))}
        </div>

        {/* 曲线卡 */}
        <PaperCard className="p-5" tilt={2}>
          <p className="font-bold mb-2">体重预测曲线 {locked && <span className="text-xs text-[var(--color-pencil)]">（会员可见）</span>}</p>
          {locked ? <LockedCurve /> : <CurveChart curve={d.predictionCurve ?? []} />}
          {!locked && typeof d.weeklyRateKg === "number" && (
            <p className="text-sm text-[var(--color-pencil)] mt-1">
              计划速率：<Marker>{d.weeklyRateKg > 0 ? "+" : ""}{d.weeklyRateKg} kg/周</Marker>
            </p>
          )}
        </PaperCard>

        {/* 付费卡（整洁笔记版） */}
        {locked && (
          <PaperCard className="p-6" tilt={1} tidy>
            <h2 className="text-xl font-bold">解锁完整方案</h2>
            <ul className="text-sm text-[var(--color-pencil)] mt-2 space-y-1 list-disc list-inside">
              <li>完整体重预测曲线与每周速率</li>
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
      </div>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense>
      <Results />
    </Suspense>
  );
}
