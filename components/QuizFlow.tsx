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
import { ensureSession, getStoredSessionId, clearStoredSessionId } from "@/lib/supabase/client";
import { QuizSidebarLeft, QuizSidebarRight } from "@/components/quiz-side";
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

/** 分组 emoji（生动性；不改题库结构，前端映射） */
const GROUP_EMOJI: Record<string, string> = {
  gender: "🚻", age: "🎂", goal: "🎯", height: "📏", weight: "⚖️",
  target_weight: "🏁", activity_frequency: "🏃",
  physical_build: "🧍", dream_body: "💫", weight_change: "📈",
  best_shape_ago: "⏳", weight_gain_causes: "🌊", other_goals: "✨",
  daily_activity: "🪑", energy_levels: "🔋", walk_freq: "🚶",
  exercise_freq: "🏋️", exercise_time: "⏱️", desired_freq: "📆",
  preferred_time: "🌅", workout_comfort: "😌",
  shortness_breath: "💨", discomfort_areas: "🩹", sleep_quality: "😴",
  stress_level: "🧘", injury_history: "🤕",
  nutrition_habit: "🥗", food_cravings: "😋", meal_planning: "📝",
  diet_type: "🍽️", fasting_knowledge: "📖", meals_per_day: "🥢",
  emotional_eating: "🎭",
};

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
  const [saveIssue, setSaveIssue] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootRef = useRef(false);
  const pendingSaves = useRef<Set<Promise<void>>>(new Set());
  const lastFailed = useRef<{ key: string; value: SavedAnswer } | null>(null);

  /** 后台保存答案（不阻塞前进）：网络/5xx 失败自动重试，业务校验失败静默，彻底失败置 saveIssue */
  const persistAnswer = useCallback((key: string, value: SavedAnswer) => {
    const sessionId = getStoredSessionId();
    if (!sessionId) return Promise.resolve();
    const p = (async () => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const res = await fetch(`/api/session/${sessionId}/step`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stepKey: key, answerValue: value }),
          });
          if (res.ok) {
            if (lastFailed.current?.key === key) { lastFailed.current = null; setSaveIssue(false); }
            return;
          }
          // 4xx 业务校验失败：前端已拦一道，静默
          if (res.status >= 400 && res.status < 500) return;
          // 5xx → 重试
        } catch {
          // 网络异常 → 重试
        }
        await new Promise((r) => setTimeout(r, 900 * attempt));
      }
      lastFailed.current = { key, value };
      setSaveIssue(true);
    })();
    pendingSaves.current.add(p);
    void p.finally(() => { pendingSaves.current.delete(p); });
    return p;
  }, []);

  /** complete 前确保所有在途保存落库 */
  const flushSaves = useCallback(async () => {
    await Promise.allSettled([...pendingSaves.current]);
  }, []);

  /** 手动重试上次失败的保存 */
  const retryFailedSave = useCallback(() => {
    if (lastFailed.current) persistAnswer(lastFailed.current.key, lastFailed.current.value);
  }, [persistAnswer]);

  const q: QuizQuestion | undefined = QUIZ_QUESTIONS[index];
  const total = QUIZ_QUESTIONS.length;

  // 首次进入：恢复或新建会话
  const bootstrap = useCallback(async () => {
    try {
      const sessionId = await ensureSession();
      let res = await fetch(`/api/session/${sessionId}`);
      // 防御：若这次 GET 竞态失败（401/404），清本地后重建，重建后按空进度渲染
      if (!res.ok) {
        clearStoredSessionId();
        const retryId = await ensureSession();
        res = await fetch(`/api/session/${retryId}`);
        if (!res.ok) throw new Error("进度恢复失败");
        setAnswers({});
        setIndex(0);
        setInterstitialAt(INTERSTITIALS[0] ? 0 : null);
        setPhase("question");
        return;
      }
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
        // 全部答完 → 先把在途保存落库，再 complete → 跳结果页
        setPhase("submitting");
        const sessionId = getStoredSessionId()!;
        (async () => {
          try {
            await flushSaves();
            const r = await fetch(`/api/session/${sessionId}/complete`, { method: "POST" });
            if (!r.ok) throw new Error("计算失败 " + r.status);
            router.push(`/results?session=${sessionId}`);
          } catch (e) {
            setErrMsg((e as Error).message);
            setPhase("error");
          }
        })();
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
    [index, total, router, flushSaves]
  );

  /** 选中 single/likert：立即反馈 + 停留后自动前进 */
  const pickSingle = useCallback(
    (optValue: string, optFeedback: string) => {
      if (!q || phase !== "question") return;
      const value = { value: optValue };
      setAnswers((prev) => ({ ...prev, [q.key]: value }));
      setFeedback(optFeedback);
      // 保存放后台（带重试），前进不再被网络卡住
      persistAnswer(q.key, value);
      timerRef.current = setTimeout(() => advance(), FEEDBACK_MS);
    },
    [q, phase, advance, persistAnswer]
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

  const submitCurrent = useCallback(() => {
    if (!q) return;
    const value: SavedAnswer =
      q.type === "multi"
        ? { values: multiDraft }
        : { value: Number(numberDraft) };
    // 本地同步记账 + 后台保存（带重试），前进不被网络卡住
    setAnswers((prev) => ({ ...prev, [q.key]: value }));
    persistAnswer(q.key, value);
    const opt = q.options?.find((o: QuizOption) => String(o.value) === String(q.type === "multi" ? multiDraft[0] : Number(numberDraft)));
    if (opt) {
      setFeedback(opt.feedback);
      timerRef.current = setTimeout(() => advance(), 900);
    } else {
      advance();
    }
  }, [q, multiDraft, numberDraft, advance, persistAnswer]);

  /** 跳到已答过的题修改：前后都可跳（目标必须已答）；草稿从已存答案预填，重交幂等 upsert */
  const goBackTo = useCallback(
    (target: number) => {
      if (phase !== "question") return;
      if (target < 0 || target >= total || target === index) return;
      if (!answers[QUIZ_QUESTIONS[target].key]) return;
      const targetQ = QUIZ_QUESTIONS[target];
      setFeedback(null);
      setNumberDraft(
        targetQ.type === "number" && typeof answers[targetQ.key]?.value === "number"
          ? String(answers[targetQ.key]!.value)
          : ""
      );
      setMultiDraft(targetQ.type === "multi" ? (answers[targetQ.key]?.values ?? []) : []);
      setIndex(target);
      setPhase("question");
    },
    [phase, index, total, answers]
  );

  // ── 渲染 ──────────────────────────────────────────────
  if (phase === "loading")
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <PaperCard className="p-8 text-center" tilt={2}>
          <p className="text-lg">正在翻开你的手账…</p>
        </PaperCard>
      </main>
    );

  // 启动期失败（无题目上下文）→ 保留全屏错误；答题中失败 → 走底部弹窗，不整页替换
  if (phase === "error" && !q)
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

  if (!(phase === "question" || phase === "error") || !q) return null;

  return (
    <main className="min-h-screen p-6 flex">
      <div className="my-auto w-full mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)_240px] gap-6">
        {/* 左翼：阶段标签 + 进度账本（窄屏隐藏） */}
        <div className="hidden md:block md:justify-self-end w-full max-w-[240px]">
          <QuizSidebarLeft index={index} answers={answers} />
        </div>

        {/* 中央答题卡 */}
        <div className="w-full max-w-lg mx-auto">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-[var(--color-pencil)] underline-sketch">Better Me 手账</span>
            <ProgressBookmarks
              current={index}
              total={total}
              onJump={goBackTo}
              isAnswered={(i) => !!answers[QUIZ_QUESTIONS[i].key]}
              answeredLabel={Object.keys(answers).length}
            />
          </div>

          <PaperCard className="p-6" tilt={index % 2 === 0 ? 1 : 2}>
            <h2 className="text-2xl font-bold mb-1">
              <span className="mr-1">{GROUP_EMOJI[q.key] ?? "📌"}</span>{q.question}
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
            <div className="mt-4">
            {typeof answers.height?.value === "number" &&
              typeof answers.weight?.value === "number" &&
              q.key !== "height" && (
                <p className="text-sm text-[var(--color-pencil)] mb-2 fade-up">
                  小抄：身高 {answers.height!.value}cm + 体重 {answers.weight!.value}kg
                  → BMI 约 <span className="digits text-lg text-[var(--color-accent)]">
                    {(answers.weight!.value / Math.pow(answers.height!.value / 100, 2)).toFixed(1)}
                  </span>
                </p>
              )}
            <div className="flex items-end gap-3">
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
              <div className="pt-2 flex items-center gap-3">
                <SketchButton
                  disabled={multiDraft.length === 0}
                  onClick={submitCurrent}
                >
                  下一步
                </SketchButton>
                {multiDraft.length > 0 && (
                  <span className="text-sm text-[var(--color-pencil)] fade-up">
                    已选 <span className="digits text-lg">{multiDraft.length}</span> 项
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 反馈批注（占位固定高，避免跳动） */}
          <div className="min-h-[3.2rem] mt-4">
            {feedback && <FeedbackNote text={feedback} />}
          </div>
          {/* 保存失败提示：不阻塞答题，可手动重试 */}
          {saveIssue && (
            <p className="mt-1 text-xs text-[var(--color-accent)]">
              刚才有答案没存上，网络恢复后点此重试：{" "}
              <button type="button" onClick={() => retryFailedSave()} className="underline">重试保存</button>
            </p>
          )}
        </PaperCard>

        <p className="mt-4 text-center text-xs text-[var(--color-pencil-light)]">
          答案实时保存在本会话手账中，中途关掉也能 <Marker>从上次的地方继续</Marker>
        </p>
        </div>

        {/* 右翼：小抄 + 橡皮章计数 + 鼓励语（窄屏隐藏） */}
        <div className="hidden md:block md:justify-self-start w-full max-w-[240px]">
          <QuizSidebarRight index={index} answers={answers} />
        </div>
      </div>

      {/* 答题中出错：弹窗覆盖在当前题上，不整页替换 */}
      {phase === "error" && (
        <div className="fixed inset-0 z-50 grid place-items-center p-6 bg-[var(--color-ink)]/25 backdrop-blur-[2px]">
          <PaperCard className="p-8 max-w-md w-full text-center" tilt={1} tidy>
            <p className="text-lg mb-3">出了点小状况</p>
            <p className="text-sm text-[var(--color-pencil)] mb-5 leading-relaxed">{errMsg}</p>
            <div className="flex justify-center gap-3">
              <SketchButton onClick={() => { setPhase("loading"); bootstrap(); }}>重试</SketchButton>
              <SketchButton onClick={() => setPhase("question")}>先继续答题</SketchButton>
            </div>
          </PaperCard>
        </div>
      )}
    </main>
  );
}
