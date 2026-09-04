"use client";

/**
 * (tabs) 路由组共享布局：顶部手绘 Tab 栏
 * - 手账 / 我的计划 / 记录 三个第一梯队 Tab
 * - 手绘风格：选中项荧光笔底 + 微旋转，未选中描边字
 * - 小屏隐藏品牌字，防止横向溢出；问卷流程（/onboarding）不进此布局，保持全屏 funnel
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "手账", icon: "📓" },
  { href: "/plan", label: "我的计划", icon: "🗓️" },
  { href: "/records", label: "记录", icon: "✏️" },
] as const;

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 bg-[var(--color-paper-dark)]/95 backdrop-blur-sm pt-3 px-3 sm:px-6 pb-1 border-b-2 border-dashed border-[var(--color-pencil-light)]/50">
        <nav className="max-w-xl mx-auto flex items-center justify-center gap-1.5 sm:gap-2">
          <span className="hidden sm:inline text-lg font-bold tracking-widest mr-3 select-none">Better Me</span>
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex-1 sm:flex-none text-center px-2.5 sm:px-3 py-1.5 sketch-border-sm text-sm whitespace-nowrap transition-all ${
                  active
                    ? "bg-[var(--color-marker)]/60 font-bold tilt-2"
                    : "bg-white/60 text-[var(--color-pencil)] hover:bg-[var(--color-sky-soft)]/50 hover:-rotate-1"
                }`}
              >
                <span className="mr-1" aria-hidden>{t.icon}</span>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}
