"use client";

/**
 * 问卷流（客户端状态机）：
 * - 33 题顺序推进；single/likert 选中即存并展示该选项 feedback，短暂停留自动进下一题
 * - multi/number 有显式"下一步"；multi 的 none 与其它项互斥（前端先拦一道，后端仍校验）
 * - 持久化：ensureSession 后每步 POST /step；首次加载若有存档 → 进度恢复
 * - 关键集群之间穿插非计数插页（节奏模块，不写库）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QUIZ_QUESTIONS } from "@/lib/quiz/config";
import type { QuizQuestion, QuizOption } from "@/lib/quiz/types";
import { ensureSession, getStoredSessionId } from "@/lib/supabase/client";
import {
  PaperCard,
  Marker,
  SketchOption,
  SketchButton,
  FeedbackNote,
  ProgressBookmarks,
} from "@/components/sketch";

type Phase =
  | "loading"
  | "error"
  | "interstitial"
  | "question"
  | "submitting"
  | "done";

interface SavedAnswer {
  value?: string | number;
  values?: string[];
}

/** 插页：出现在指定题目序号之前（不计入 33 题，不写库） */
const INTERSTITIALS: Record<number, { eyebrow: string; title: string; sub: string }> = {
  7: {
    eyebrow: "进度里程碑",
    title: "核心数据已就位！",
    sub: "你的身体档案已经建立，接下来聊聊你的生活方式。",
  },
  13: {
    eyebrow: "个性化回应",
    title: "很多人都和你一样",
    sub: "从这一步开始改变的人，后来都庆幸自己坚持了下来。",
  },
  21: {
    eyebrow: "进度里程碑",
    title: "运动画像完成 2/3",
    sub: "我们正在把你的训练节奏拼完整，继续！",
  },
  26: {
    eyebrow: "算法预览",
    title: "再补几个问题",
    sub: "就能算出你的 BMI、每日热量与目标达成日期。",
  },
  33: {
    eyebrow: "准备好了",
    title: "最后一题！",
    sub: "提交后我们会立刻为你计算专属健康方案。",
  },
};

const FEEDBACK_MS = 1100;

export default function QuizFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errMsg, setErrMsg] = useState("");
  const [index, setIndex] = useState(0); // 当前题目序（0..32）
  const [answers, setAnswers] = useState<Record<string, SavedAnswer>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [numberDraft, setNumberDraft] = useState("");
  const [multiDraft, setMultiDraft] = useState<string[]>([]);
  const [interstitialAt, setInterstitialAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootRef = useRef(false);

  const q: QuizQuestion | undefined = QUIZ_QUESTIONS[index];
  const total = QUIZ_QUESTIONS.length;

  // 首次进入：恢复或新建会话
  const bootstrap = useCallback(async () => {
    try {
      const sessionId = await ensureSession();
      const res = await fetch(`/api/session/${sessionId}`);
      if (!res.ok) throw new Error("进度恢复失败");
      const data = (await res.json()) as {
        currentStep: number;
        answers: Record<string, SavedAnswer>;
      };
      const saved = data.answers ?? {};
      setAnswers(saved);
      if (data.currentStep >= total) {
        router.push(`/results?session=${sessionId}`);
        return;
      }
      setIndex(data.currentStep);
      // 跳过插页定位：若恢复点正好是插页位，先展示插页
      if (INTERSTITIALS[data.currentStep]) setInterstitialAt(data.currentStep);
      setPhase("question");
    } catch (e) {
      setErrMsg((e as Error).message);
      setPhase("error");
    }
  }, [total, router]);

  useEffect(() => {
    if (bootRef.current) return; // StrictMode 双跑守卫
    bootRef.current = true;
    bootstrap();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bootstrap]);

  const currentDraft = useMemo<SavedAnswer>(() => {
    if (!q) return {};
    if (answers[q.key]) return answers[q.key]!;
    if (q.type === "multi") return { values: multiDraft };
    if (q.type === "number") return numberDraft ? { value: Number(numberDraft) } : {};
    return {};
  }, [q, answers, multiDraft, numberDraft]);

  const advance = useCallback(
    () => {
      setFeedback(null);
      setNumberDraft("");
      setMultiDraft([]);
      const next = index + 1;
      if (next >= total) {
        // 全部答完 → complete → 跳结果页
        setPhase("submitting");
        const sessionId = getStoredSessionId()!;
        fetch(`/api/session/${sessionId}/complete`, { method: "POST" })
          .then((r) => {
            if (!r.ok) throw new Error("计算失败 " + r.status);
            router.push(`/results?session=${sessionId}`);
          })
          .catch((e) => {
            setErrMsg((e as Error).message);
            setPhase("error");
          });
        return;
      }
      if (INTERSTITIALS[next]) {
        setInterstitialAt(next);
        setPhase("interstitial");
      } else {
        setIndex(next);
        setPhase("question");
      }
    },
    [index, total, router]
  );

  const saveStep = useCallback(
    async (key: string, value: SavedAnswer) => {
      const sessionId = getStoredSessionId()!;
      const res = await fetch(`/api/session/${sessionId}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepKey: key, answerValue: value }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { detail?: string[] };
        throw new Error(j.detail?.join("; ") || `保存失败 ${res.status}`);
      }
    },
    []
  );

  /** 选中 single/likert：立即反馈 + 停留后自动前进 */
  const pickSingle = useCallback(
    (optValue: string, optFeedback: string) => {
      if (!q || phase !== "question") return;
      const value = { value: optValue };
      setAnswers((prev) => ({ ...prev, [q.key]: value }));
      setFeedback(optFeedback);
      timerRef.current = setTimeout(() => {
        saveStep(q.key, value)
          .then(() => advance())
          .catch((e) => {
            setErrMsg((e as Error).message);
            setPhase("error");
          });
      }, FEEDBACK_MS);
    },
    [q, phase, advance, saveStep]
  );

  const toggleMulti = useCallback(
    (optValue: string, exclusive?: boolean) => {
      if (!q) return;
      setMultiDraft((prev) => {
        if (exclusive) return prev.includes(optValue) ? [] : [optValue];
        const base = prev.filter((v) => {
          const ex = q.options?.find((o: QuizOption) => o.value === v)?.exclusive;
          return !ex; // 选普通项时剔除 none
        });
        return base.includes(optValue) ? base.filter((v) => v !== optValue) : [...base, optValue];
      });
    },
    [q]
  );

  const submitCurrent = useCallback(async () => {
    if (!q) return;
    const value: SavedAnswer =
      q.type === "multi"
        ? { values: multiDraft }
        : { value: Number(numberDraft) };
    try {
      await saveStep(q.key, value);
      const opt = q.options?.find((o: QuizOption) => String(o.value) === String(q.type === "multi" ? multiDraft[0] : Number(numberDraft)));
      if (opt) {
        setFeedback(opt.feedback);
        timerRef.current = setTimeout(() => advance(), 900);
      } else {
        advance();
      }
    } catch (e) {
      setErrMsg((e as Error).message);
      setPhase("error");
    }
  }, [q, multiDraft, numberDraft, advance, saveStep]);

  // ── 渲染 ──────────────────────────────────────────────
  if (phase === "loading")
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <PaperCard className="p-8 text-center" tilt={2}>
          <p className="text-lg">正在翻开你的手账…</p>
        </PaperCard>
      </main>
    );

  if (phase === "error")
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <PaperCard className="p-8 max-w-md text-center" tilt={1}>
          <p className="text-lg mb-3">出了点小状况</p>
          <p className="text-sm text-[var(--color-pencil)] mb-4">{errMsg}</p>
          <SketchButton onClick={() => { setPhase("loading"); bootstrap(); }}>重试</SketchButton>
        </PaperCard>
      </main>
    );

  if (phase === "submitting")
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <PaperCard className="p-10 text-center" tilt={3}>
          <p className="text-xl mb-2">正在为你计算专属方案…</p>
          <svg width="120" height="30" viewBox="0 0 120 30" className="draw-in mx-auto" style={{ ["--dash" as string]: 200 }}>
            <path d="M4 22 C 24 4, 40 28, 60 14 S 100 20, 116 8" fill="none" stroke="var(--color-pencil)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </PaperCard>
      </main>
    );

  if (phase === "interstitial" && interstitialAt !== null) {
    const it = INTERSTITIALS[interstitialAt];
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="max-w-lg w-full">
          <ProgressBookmarks current={interstitialAt} total={total} />
          <PaperCard className="p-10 mt-4 text-center" tilt={1}>
            <p className="text-sm tracking-widest text-[var(--color-pencil)] mb-3">{it.eyebrow}</p>
            <h2 className="text-3xl font-bold mb-3">{it.title}</h2>
            <p className="text-[var(--color-pencil)] mb-8">{it.sub}</p>
            <SketchButton
              tone="accent"
              onClick={() => {
                setInterstitialAt(null);
                setIndex(interstitialAt);
                setPhase("question");
              }}
            >
              继续 →
            </SketchButton>
          </PaperCard>
        </div>
      </main>
    );
  }

  if (phase !== "question" || !q) return null;

  return (
    <main className="min-h-screen p-6 flex flex-col items-center">
      <div className="w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-[var(--color-pencil)] underline-sketch">Better Me 手账</span>
          <ProgressBookmarks current={index} total={total} />
        </div>

        <PaperCard className="p-6" tilt={index % 2 === 0 ? 1 : 2}>
          <h2 className="text-2xl font-bold mb-1">
            {q.question}
            {q.numeric && (
              <span className="ml-2 text-sm text-[var(--color-pencil)]">
                （{q.numeric.min}–{q.numeric.max} {q.numeric.unit}）
              </span>
            )}
          </h2>
          {!q.required && (
            <p className="text-xs text-[var(--color-pencil-light)] mb-2">这题选填</p>
          )}

          {/* 单选 / 量表 */}
          {(q.type === "single" || q.type === "likert") && (
            <div className="mt-4 space-y-2.5">
              {q.options!.map((o: QuizOption) => (
                <SketchOption
                  key={o.value}
                  label={o.label}
                  selected={currentDraft.value === o.value}
                  onClick={() => pickSingle(o.value, o.feedback)}
                />
              ))}
            </div>
          )}

          {/* 数字输入 */}
          {q.type === "number" && (
            <div className="mt-4 flex items-end gap-3">
              <input
                type="number"
                inputMode="decimal"
                min={q.numeric!.min}
                max={q.numeric!.max}
                value={numberDraft}
                onChange={(e) => setNumberDraft(e.target.value)}
                className="digits text-4xl w-32 px-3 py-1 bg-[var(--color-sun-soft)]/60 sketch-border-sm outline-none focus:bg-white"
              />
              <span className="text-lg text-[var(--color-pencil)] pb-2">{q.numeric!.unit}</span>
              <span className="ml-auto pb-2">
                <SketchButton disabled={!numberDraft} onClick={submitCurrent}>
                  记下了
                </SketchButton>
              </span>
            </div>
          )}

          {/* 多选 */}
          {q.type === "multi" && (
            <div className="mt-4 space-y-2.5">
              {q.options!.map((o: QuizOption) => (
                <SketchOption
                  key={o.value}
                  label={o.label + (o.exclusive ? "（选这个就别选别的啦）" : "")}
                  selected={multiDraft.includes(o.value)}
                  onClick={() => toggleMulti(o.value, o.exclusive)}
                />
              ))}
              <div className="pt-2">
                <SketchButton
                  disabled={multiDraft.length === 0}
                  onClick={submitCurrent}
                >
                  下一步
                </SketchButton>
              </div>
            </div>
          )}

          {/* 反馈批注（占位固定高，避免跳动） */}
          <div className="min-h-[3.2rem] mt-4">
            {feedback && <FeedbackNote text={feedback} />}
          </div>
        </PaperCard>

        <p className="mt-4 text-center text-xs text-[var(--color-pencil-light)]">
          答案实时保存在本会话手账中，中途关掉也能 <Marker>从上次的地方继续</Marker>
        </p>
      </div>
    </main>
  );
}
