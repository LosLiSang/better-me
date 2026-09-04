/** 基础手绘组件：纸卡 / 草图按钮 / 荧光笔批注 / 进度书签 */
"use client";

import type { ReactNode } from "react";

/** 纸卡：微旋转 + 不规则边框（入场轻抖一次） */
export function PaperCard({
  children,
  className = "",
  tilt = 1,
  tidy = false,
}: {
  children: ReactNode;
  className?: string;
  tilt?: 1 | 2 | 3;
  tidy?: boolean;
}) {
  const tiltCls = tilt === 1 ? "tilt-1" : tilt === 2 ? "tilt-2" : "tilt-3";
  return (
    <div
      className={`wobble-in bg-white/80 backdrop-blur-[1px] shadow-[3px_4px_0_rgba(59,58,54,0.12)] ${
        tidy ? "sketch-border-tidy" : "sketch-border"
      } ${tiltCls} ${className}`}
    >
      {children}
    </div>
  );
}

/** 荧光笔高亮 */
export function Marker({ children }: { children: ReactNode }) {
  return <span className="marker-yellow">{children}</span>;
}

/** 选项按钮（single/likert 卡）：选中即"手绘勾+荧光底" */
export function SketchOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sketch-option-btn w-full text-left px-4 py-3 transition-all sketch-border-sm tilt-3 hover:rotate-0 ${
        selected
          ? "option-picked bg-[var(--color-marker)]/60 font-bold"
          : "bg-white/70 hover:bg-[var(--color-sky-soft)]/50"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-block w-4 h-4 border-2 border-[var(--color-ink)] rounded-full ${
            selected ? "bg-[var(--color-accent)]" : "bg-white"
          }`}
        />
        {label}
      </span>
    </button>
  );
}

/** 主 CTA（继续/下一步）：手绘按钮 + 按下位移 */
export function SketchButton({
  children,
  onClick,
  disabled,
  tone = "ink",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "ink" | "accent";
}) {
  const toneCls =
    tone === "accent"
      ? "bg-[var(--color-accent)] text-white"
      : "bg-[var(--color-sky-soft)] text-[var(--color-ink)]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2 sketch-border-sm font-bold tracking-wide transition-transform active:translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed ${toneCls}`}
    >
      {children}
    </button>
  );
}

/** 反馈批注：手写小纸条（答题后出现） */
export function FeedbackNote({ text }: { text: string }) {
  return (
    <div className="relative inline-block">
      <div className="fade-up inline-block px-3 py-2 bg-[var(--color-sun-soft)] sketch-border-sm tilt-2 text-[15px] leading-relaxed max-w-[22rem]">
        <span aria-hidden className="mr-1">✎</span>
        {text}
      </div>
      <span className="stamp-in absolute -top-3 -right-4 text-[11px] font-bold text-[var(--color-accent)] border-2 border-[var(--color-accent)] rounded px-1 py-0.5 bg-white/80 pointer-events-none">
        已记下 ✓
      </span>
    </div>
  );
}

/** 进度书签：画在手账边缘的小标签（33 题用小尺寸 + 可换行） */
export function ProgressBookmarks({
  current,
  total,
  onJump,
  isAnswered,
  answeredLabel,
}: {
  current: number;
  total: number;
  /** 点击已答圆点回退到那题（不传 = 纯展示不可点） */
  onJump?: (index: number) => void;
  /** 第 i 题是否已答：传入后实心=已答可跳（含向前跳回已答题），金色=当前题，空心=未答；缺省退化为 i < current */
  isAnswered?: (i: number) => boolean;
  /** 计数文案展示的已答数；缺省用 current */
  answeredLabel?: number;
}) {
  const step = Math.min(current, total);
  const label = answeredLabel ?? step;
  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-[60%]" aria-label={`进度 ${label}/${total}`}>
      <span className="digits text-lg mr-1">{label}/{total}</span>
      <span className="flex flex-wrap gap-[3px] max-w-[250px] justify-end">
        {Array.from({ length: total }, (_, i) => {
          const answered = isAnswered ? isAnswered(i) : i < step;
          const canJump = !!onJump && i !== step && answered;
          const dot = (
            <span
              className={`inline-block h-[7px] w-[7px] rounded-full align-middle ${
                i === step
                  ? "mark-pop bg-[var(--color-sun-deep)]"
                  : answered
                    ? "bg-[var(--color-mint)]"
                    : "bg-[var(--color-paper-dark)] ring-1 ring-[var(--color-pencil-light)]"
              } transition-transform`}
            />
          );
          return (
            <span key={`${step}-${i}`} className="p-[2px] leading-none">
              {canJump ? (
                <button
                  type="button"
                  aria-label={`回到第 ${i + 1} 题修改`}
                  title={`回到第 ${i + 1} 题修改`}
                  onClick={() => onJump(i)}
                  className="block cursor-pointer hover:scale-150 transition-transform"
                >
                  {dot}
                </button>
              ) : (
                dot
              )}
            </span>
          );
        })}
      </span>
    </div>
  );
}
