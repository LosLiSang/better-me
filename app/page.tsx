import Link from "next/link";
import { PaperCard, Marker, SketchButton } from "@/components/sketch";

export default function Home() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-lg">
        <PaperCard className="p-10 text-center" tilt={1}>
          <p className="text-sm tracking-widest text-[var(--color-pencil)] mb-2">
            你的健康手账
          </p>
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
            <SketchButton tone="accent" >
              开始我的手账 →
            </SketchButton>
          </Link>
        </PaperCard>

        <p className="mt-4 text-center text-xs text-[var(--color-pencil-light)]">
          无需注册，点开即用 · 数据仅用于生成你的专属计划
        </p>
      </div>
    </main>
  );
}
