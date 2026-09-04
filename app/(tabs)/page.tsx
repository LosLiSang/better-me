import Link from "next/link";
import { PaperCard, Marker, SketchButton } from "@/components/sketch";

/**
 * 首页 / 手账（第一梯队 Tab）：
 * - 品牌语 + 主 CTA 入口问卷
 * - 三步怎么玩 / 能拿到什么 / 每天一分钟，内容加厚建立产品感
 */

const STEPS = [
  { n: "①", title: "三分钟小问卷", desc: "33 个小问题，像写手账一样轻松，中途关掉随时回来接着写。" },
  { n: "②", title: "算出你的专属方案", desc: "BMI、每日热量、目标日期与体重预测曲线，一目了然。" },
  { n: "③", title: "每天动手写一笔", desc: "30 天每日计划 + 体重打卡，看着预测曲线被真实曲线一点点追上。" },
] as const;

const FEATURES = [
  { icon: "📐", title: "BMI · 热量 · 目标日期", desc: "服务器精确计算，不拍脑袋", href: "/plan", cta: "看看示例 →" },
  { icon: "📈", title: "体重预测曲线", desc: "每周该到哪，提前替你画好", href: "/plan", cta: "去我的计划 →" },
  { icon: "✏️", title: "每日打卡手账", desc: "记录体重与状态，坚持看得见", href: "/records", cta: "去记录 →" },
] as const;

export default function Home() {
  return (
    <main className="p-6">
      <div className="w-full max-w-xl mx-auto space-y-6">
        {/* Hero */}
        <PaperCard className="p-10 text-center" tilt={1}>
          <p className="text-sm tracking-widest text-[var(--color-pencil)] mb-2">你的健康手账</p>
          <h1 className="text-4xl font-bold leading-snug mb-4">
            三分钟，算出属于你的
            <br />
            <Marker>BMI · 热量 · 目标日期</Marker>
          </h1>
          <p className="text-[var(--color-pencil)] mb-8 leading-relaxed">
            33 个小问题，像写手账一样轻松。
            <br />
            中途关掉也没关系，随时回来接着写。
          </p>
          <Link href="/onboarding">
            <SketchButton tone="accent">开始我的手账 →</SketchButton>
          </Link>
        </PaperCard>

        {/* 三步怎么玩 */}
        <PaperCard className="p-6" tilt={2}>
          <p className="font-bold mb-4">🖋️ 三步，开始你的手账</p>
          <ol className="space-y-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-3 items-start">
                <span className="text-xl leading-none mt-0.5" aria-hidden>{s.n}</span>
                <div>
                  <p className="font-bold">{s.title}</p>
                  <p className="text-sm text-[var(--color-pencil)] leading-relaxed">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </PaperCard>

        {/* 你会得到什么 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FEATURES.map((f, i) => (
            <PaperCard key={f.title} className="p-4" tilt={((i % 3) + 1) as 1 | 2 | 3}>
              <p className="text-2xl" aria-hidden>{f.icon}</p>
              <p className="font-bold mt-1 text-sm leading-snug">{f.title}</p>
              <p className="text-xs text-[var(--color-pencil)] mt-1 mb-2">{f.desc}</p>
              <Link href={f.href} className="underline-sketch text-xs text-[var(--color-sky-deep)]">
                {f.cta}
              </Link>
            </PaperCard>
          ))}
        </div>

        <p className="text-center text-xs text-[var(--color-pencil-light)] pb-8">
          无需注册，点开即用 · 数据仅用于生成你的专属计划
        </p>
      </div>
    </main>
  );
}
