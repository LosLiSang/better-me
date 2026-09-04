"use client";

/**
 * 问卷两翼便签妆点（方案 A）
 * - 左翼：进度账本（已答题便签 + 勾）+ 阶段标签（当前段荧光高亮）
 * - 右翼：实时小抄（BMI 预览/已选关键值）+ 橡皮章计数 + 阶段鼓励语
 * 均为上下文相关内容，复用手绘组件；窄屏(md以下)由布局层隐藏为单列。
 */

import { PaperCard, Marker } from "@/components/sketch";
import { QUIZ_QUESTIONS } from "@/lib/quiz/config";

/** 题目 → 便签短文本（记账感） */
export const STEP_NOTE: Record<string, string> = {
  gender: "性别", age: "年龄", goal: "目标",
  height: "身高", weight: "体重", target_weight: "目标体重",
  activity_frequency: "每周运动",
  physical_build: "体型", dream_body: "理想体态", weight_change: "体重变化",
  best_shape_ago: "上次最佳", weight_gain_causes: "增重诱因", other_goals: "附加目标",
  daily_activity: "日常状态", energy_levels: "精力", walk_freq: "散步频率",
  exercise_freq: "运动频率", exercise_time: "单次时长", desired_freq: "期望频率",
  preferred_time: "偏好时段", workout_comfort: "运动舒适",
  shortness_breath: "呼吸", discomfort_areas: "不适部位", sleep_quality: "睡眠",
  stress_level: "压力", injury_history: "伤病史",
  nutrition_habit: "饮食", food_cravings: "渴望食物", meal_planning: "三餐规划",
  diet_type: "饮食方式", fasting_knowledge: "断食了解", meals_per_day: "每天餐数",
  emotional_eating: "情绪进食",
};

/** 阶段分组：[起始题序, 结束题序, 名字]（1-based 题号） */
export const STAGES: { start: number; end: number; name: string }[] = [
  { start: 1, end: 7, name: "基础档案" },
  { start: 8, end: 13, name: "身体与习惯" },
  { start: 14, end: 21, name: "运动体能" },
  { start: 22, end: 26, name: "健康限制" },
  { start: 27, end: 33, name: "营养情绪" },
];

/** 阶段 → 鼓励语 */
const STAGE_ENCOURAGE: Record<string, string> = {
  "基础档案": "先把身体底子记清楚，后面才好算账。",
  "身体与习惯": "这些习惯细节，决定了方案会不会跑偏。",
  "运动体能": "训练这一块，我们会帮你排得刚刚好。",
  "健康限制": "有这些我们也提前避开，不让你难受。",
  "营养情绪": "最后一步啦，吃完这顿就收官！",
};

function currentStage(index: number): { start: number; end: number; name: string } | undefined {
  const q = index + 1; // 1-based
  return STAGES.find((s) => q >= s.start && q <= s.end);
}

/** 左翼：阶段标签 + 进度账本 */
export function QuizSidebarLeft({
  index,
  answers,
}: {
  index: number;
  answers: Record<string, { value?: string | number; values?: string[] }>;
}) {
  const stage = currentStage(index);
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-4">
      {/* 阶段标签 */}
      <PaperCard className="p-4" tilt={2}>
        <p className="text-xs text-[var(--color-pencil)] tracking-widest mb-2">你在哪一段</p>
        <div className="space-y-1.5">
          {STAGES.map((s) => {
            const active = stage?.name === s.name;
            return (
              <div
                key={s.name}
                className={`flex items-center gap-2 text-sm px-2 py-1 sketch-border-sm ${
                  active ? "bg-[var(--color-marker)]/60 font-bold" : "bg-white/60 opacity-70"
                }`}
              >
                <span className="digits">{s.start}-{s.end}</span>
                <span>{s.name}</span>
                {active && <span className="ml-auto text-xs">✎ 正在写</span>}
              </div>
            );
          })}
        </div>
      </PaperCard>

      {/* 进度账本：已答题便签（回退编辑时保留全部已答行，当前行标「待编辑」） */}
      <PaperCard className="p-4" tilt={1}>
        <p className="text-xs text-[var(--color-pencil)] tracking-widest mb-2">
          我的账本 · 已记 {answeredCount}/33
        </p>
        <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
          {QUIZ_QUESTIONS.slice(0, Math.max(index, answeredCount - 1) + 1).map((q, i) => {
            const done = !!answers[q.key];
            const cur = i === index;
            const editing = cur && done; // 回退重答：这一笔已记过，正在改
            return (
              <div
                key={q.key}
                className={`flex items-center gap-2 text-sm px-2 py-1 ${
                  cur
                    ? "bg-[var(--color-sun-soft)] sketch-border-sm tilt-3"
                    : done
                      ? "bg-white/40"
                      : "bg-white/30 opacity-60"
                }`}
              >
                <span className="w-4 text-center">{cur ? "✎" : done ? "✓" : "·"}</span>
                <span className="truncate">{STEP_NOTE[q.key] ?? q.key}</span>
                {editing && (
                  <span className="ml-auto shrink-0 text-[10px] px-1.5 py-px bg-[var(--color-marker)]/70 sketch-border-sm">
                    待编辑
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </PaperCard>
    </div>
  );
}

/** 右翼：小抄 + 橡皮章计数 + 鼓励语 */
export function QuizSidebarRight({
  index,
  answers,
}: {
  index: number;
  answers: Record<string, { value?: string | number; values?: string[] }>;
}) {
  const stage = currentStage(index);
  const h = answers.height?.value;
  const w = answers.weight?.value;
  const bmi =
    typeof h === "number" && typeof w === "number"
      ? (w / Math.pow(h / 100, 2)).toFixed(1)
      : null;
  const goal = answers.goal?.value;

  return (
    <div className="space-y-4">
      {/* 你的小抄（实时） */}
      <PaperCard className="p-4" tilt={1}>
        <p className="text-xs text-[var(--color-pencil)] tracking-widest mb-2">您的实时小抄</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-pencil)]">BMI</span>
            <span className="digits text-xl text-[var(--color-accent)]">{bmi ?? "待两项"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-pencil)]">目标</span>
            <span className="font-bold">
              {goal === "lose_weight" ? "减重" : goal === "maintain" ? "保持" : goal === "gain_weight" ? "增重" : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-pencil)]">体重</span>
            <span className="digits">{w ? `${w} kg` : "待填"}</span>
          </div>
        </div>
      </PaperCard>

      {/* 橡皮章计数 */}
      <PaperCard className="p-4 text-center" tilt={3}>
        <p className="text-[11px] text-[var(--color-pencil)] tracking-widest">已答</p>
        <p className="digits text-5xl">
          {Object.keys(answers).length}
          <span className="text-2xl text-[var(--color-pencil-light)]"> /33</span>
        </p>
        <div className="mt-2 flex justify-center gap-1">
          {QUIZ_QUESTIONS.slice(0, Math.min(33, Object.keys(answers).length)).map((q) => (
            <span key={q.key} className="h-1.5 w-1.5 rounded-full bg-[var(--color-mint)]" />
          ))}
        </div>
      </PaperCard>

      {/* 阶段鼓励语 */}
      <PaperCard className="p-4" tilt={2}>
        <p className="text-sm leading-relaxed">
          <span aria-hidden className="mr-1">💬</span>
          <Marker>{stage ? STAGE_ENCOURAGE[stage.name] : "马上开始！"}</Marker>
        </p>
      </PaperCard>
    </div>
  );
}
