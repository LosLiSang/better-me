"use client";

/**
 * 我的计划（第一梯队 Tab）：
 * - 已有有效会话 → 直接展示最新结果（ResultView）
 * - 没有会话 → 空状态引导去做测评
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { PaperCard, SketchButton, Marker } from "@/components/sketch";
import ResultView from "@/components/ResultView";
import { getStoredSessionId } from "@/lib/supabase/client";

export default function PlanPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载时读本地会话标识
    setSessionId(getStoredSessionId());
    setReady(true);
  }, []);

  if (!ready)
    return (
      <main className="p-6">
        <div className="max-w-xl mx-auto pt-8">
          <PaperCard className="p-8" tilt={1}><p>正在翻看你的手账…</p></PaperCard>
        </div>
      </main>
    );

  if (!sessionId)
    return (
      <main className="p-6">
        <div className="max-w-xl mx-auto pt-8">
          <PaperCard className="p-10 text-center" tilt={2}>
            <p className="text-4xl" aria-hidden>🗓️</p>
            <h1 className="text-2xl font-bold mt-3">
              这里还<Marker>空着</Marker>呢
            </h1>
            <p className="text-[var(--color-pencil)] mt-3 leading-relaxed">
              先花三分钟写一份小问卷，
              <br />
              你的 BMI、热量目标、体重预测曲线和 30 天计划都会出现在这里。
            </p>
            <div className="mt-6">
              <Link href="/onboarding">
                <SketchButton tone="accent">去写我的手账 →</SketchButton>
              </Link>
            </div>
          </PaperCard>
        </div>
      </main>
    );

  return (
    <main className="p-6">
      <div className="max-w-xl mx-auto">
        <ResultView sessionId={sessionId} />
      </div>
    </main>
  );
}
