"use client";

/**
 * 记录（第一梯队 Tab）：每日体重打卡手账（本地存储 MVP）
 * - 打卡：体重（必填）+ 一句话状态（可选），一天一条（重复打卡覆盖当天）
 * - 曲线：真实体重折线 + 目标体重水平虚线（预测曲线逐周对比待打卡数据挂库后做）
 * - 数据目前存 localStorage（不上传）；后续可迁移 result 表打卡子表
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PaperCard, SketchButton, Marker } from "@/components/sketch";
import { getStoredSessionId } from "@/lib/supabase/client";

const CHECKIN_KEY = "betterme.checkins";

interface CheckIn {
  date: string; // YYYY-MM-DD
  weightKg: number;
  note?: string;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadCheckins(): CheckIn[] {
  try {
    const raw = localStorage.getItem(CHECKIN_KEY);
    return raw ? (JSON.parse(raw) as CheckIn[]) : [];
  } catch {
    return [];
  }
}

/** 手绘体重曲线：实线=真实打卡，虚线=目标体重 */
function WeightChart({ entries, targetKg }: { entries: CheckIn[]; targetKg: number | null }) {
  const w = 340;
  const h = 160;
  const pad = 28;
  const ys = entries.map((e) => e.weightKg);
  const all = targetKg != null ? [...ys, targetKg] : ys;
  const minY = Math.min(...all);
  const maxY = Math.max(...all);
  const span = Math.max(maxY - minY, 1);
  const px = (i: number) => (entries.length === 1 ? w / 2 : pad + (i / (entries.length - 1)) * (w - pad * 2));
  const py = (kg: number) => h - pad - ((kg - (minY - span * 0.15)) / (span * 1.3)) * (h - pad * 2);
  const line = entries.map((e, i) => `${px(i).toFixed(1)},${py(e.weightKg).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full draw-in" style={{ ["--dash" as string]: 1200 }}>
      {targetKg != null && (
        <>
          <line
            x1={pad} y1={py(targetKg)} x2={w - pad} y2={py(targetKg)}
            stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="7 6"
          />
          <text x={w - pad} y={py(targetKg) - 6} fontSize="11" textAnchor="end" fill="var(--color-accent)">
            目标 {targetKg.toFixed(1)} kg
          </text>
        </>
      )}
      {entries.length === 1 ? (
        <circle cx={px(0)} cy={py(entries[0].weightKg)} r="5" fill="white" stroke="var(--color-ink)" strokeWidth="2" />
      ) : (
        <polyline points={line} fill="none" stroke="var(--color-mint)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {entries.map((e, i) => (
        <g key={e.date}>
          <circle cx={px(i)} cy={py(e.weightKg)} r="4" fill="white" stroke="var(--color-ink)" strokeWidth="2" />
          {(entries.length <= 7 || i % Math.ceil(entries.length / 6) === 0 || i === entries.length - 1) && (
            <text x={px(i)} y={h - 8} fontSize="9" textAnchor="middle" fill="var(--color-pencil-light)">
              {e.date.slice(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function RecordsPage() {
  const [entries, setEntries] = useState<CheckIn[]>([]);
  const [ready, setReady] = useState(false);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [targetKg, setTargetKg] = useState<number | null>(null);
  const [hasSession, setHasSession] = useState(false);

  const persist = useCallback((list: CheckIn[]) => {
    localStorage.setItem(CHECKIN_KEY, JSON.stringify(list));
    setEntries(list);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载时读本地状态（打卡/会话标识）与最新结果
    persist(loadCheckins());
    setHasSession(!!getStoredSessionId());
    (async () => {
      const sid = getStoredSessionId();
      if (!sid) return;
      try {
        const r = await fetch(`/api/session/${sid}/result`);
        if (!r.ok) return;
        const j = (await r.json()) as { locked?: boolean; data?: { predictionCurve?: { week: number; weightKg: number }[] } };
        const curve = j.data?.predictionCurve ?? [];
        if (curve.length >= 2) setTargetKg(curve[curve.length - 1].weightKg);
      } catch {
        /* 目标线是加分项，取不到不阻塞 */
      }
    })();
    setReady(true);
  }, [persist]);

  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const first = entries[0].weightKg;
    const last = entries[entries.length - 1].weightKg;
    const delta = last - first;
    const toGo = targetKg != null ? last - targetKg : null;
    // 连续天数：从今天往回数，每天都有打卡
    let streak = 0;
    const dates = new Set(entries.map((e) => e.date));
    const d = new Date();
    for (;;) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!dates.has(key)) break;
      streak += 1;
      d.setDate(d.getDate() - 1);
    }
    return { first, last, delta, toGo, streak };
  }, [entries, targetKg]);

  function submit() {
    const kg = Number(weight);
    if (!Number.isFinite(kg) || kg < 25 || kg > 300) {
      setMsg("体重看起来不太对，填 25–300 之间的数字吧");
      return;
    }
    const t = today();
    const rest = entries.filter((e) => e.date !== t);
    const next = [...rest, { date: t, weightKg: kg, note: note.trim() || undefined }].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    persist(next);
    setWeight("");
    setNote("");
    setMsg(`已记下 ${t} 这一笔 ✅`);
  }

  return (
    <main className="p-6">
      <div className="max-w-xl mx-auto space-y-5 pt-2">
        <div className="text-center">
          <p className="text-sm tracking-widest text-[var(--color-pencil)]">你的健康手账 · 记录</p>
          <h1 className="text-3xl font-bold mt-1">
            每天<Marker>写一笔</Marker>，坚持看得见
          </h1>
        </div>

        {/* 打卡表单 */}
        <PaperCard className="p-5" tilt={1}>
          <p className="font-bold mb-3">✏️ 今日打卡 {ready && <span className="text-xs font-normal text-[var(--color-pencil)]">（{today()}）</span>}</p>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="体重 kg"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-32 px-3 py-2 bg-white sketch-border-tidy digits outline-none focus:border-[var(--color-sky-deep)]"
            />
            <input
              type="text"
              maxLength={30}
              placeholder="今天状态一句话（选填）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1 px-3 py-2 bg-white sketch-border-tidy outline-none focus:border-[var(--color-sky-deep)]"
            />
            <SketchButton onClick={submit} disabled={!weight}>记一笔</SketchButton>
          </div>
          {msg && <p className="text-sm fade-up mt-2">{msg}</p>}
          {!hasSession && (
            <p className="text-xs text-[var(--color-pencil-light)] mt-2">
              还没做过测评？先去 <Link href="/onboarding" className="underline-sketch">写一份手账</Link>，就能和目标体重线对比啦。
            </p>
          )}
        </PaperCard>

        {/* 曲线 + 统计 */}
        {entries.length > 0 && stats && (
          <>
            <PaperCard className="p-5" tilt={2}>
              <p className="font-bold mb-2">📈 真实体重曲线</p>
              <WeightChart entries={entries} targetKg={targetKg} />
            </PaperCard>

            <div className="grid grid-cols-3 gap-3">
              <PaperCard className="p-4 text-center" tilt={1}>
                <p className="text-xs text-[var(--color-pencil)]">已坚持</p>
                <p className="digits text-3xl text-[var(--color-mint)]">{stats.streak}</p>
                <p className="text-xs text-[var(--color-pencil)]">连续天数</p>
              </PaperCard>
              <PaperCard className="p-4 text-center" tilt={2}>
                <p className="text-xs text-[var(--color-pencil)]">累计变化</p>
                <p className={`digits text-3xl ${stats.delta <= 0 ? "text-[var(--color-mint)]" : "text-[var(--color-accent)]"}`}>
                  {stats.delta > 0 ? "+" : ""}{stats.delta.toFixed(1)}
                </p>
                <p className="text-xs text-[var(--color-pencil)]">kg</p>
              </PaperCard>
              <PaperCard className="p-4 text-center" tilt={3}>
                <p className="text-xs text-[var(--color-pencil)]">距目标</p>
                <p className="digits text-3xl">{stats.toGo != null ? stats.toGo.toFixed(1) : "—"}</p>
                <p className="text-xs text-[var(--color-pencil)]">kg</p>
              </PaperCard>
            </div>

            {/* 打卡历史 */}
            <PaperCard className="p-5" tilt={1}>
              <p className="font-bold mb-3">📓 打卡历史</p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {[...entries].reverse().map((e) => (
                  <div key={e.date} className="flex items-baseline gap-3 bg-white/70 sketch-border-sm tilt-3 px-3 py-2">
                    <span className="digits text-sm text-[var(--color-pencil)]">{e.date}</span>
                    <span className="digits font-bold">{e.weightKg.toFixed(1)} kg</span>
                    {e.note && <span className="text-xs text-[var(--color-pencil)] truncate">{e.note}</span>}
                  </div>
                ))}
              </div>
            </PaperCard>
          </>
        )}

        {entries.length === 0 && ready && (
          <PaperCard className="p-8 text-center" tilt={2}>
            <p className="text-4xl" aria-hidden>✏️</p>
            <p className="text-[var(--color-pencil)] mt-3 leading-relaxed">
              第一笔从这里开始——
              <br />
              明天再来写下第二笔，连续打卡天数就会亮起来。
            </p>
          </PaperCard>
        )}

        <p className="text-center text-xs text-[var(--color-pencil-light)] pb-8">
          打卡数据暂存本机浏览器（不上传） · 换设备/清缓存会丢失
        </p>
      </div>
    </main>
  );
}
