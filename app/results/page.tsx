"use client";

/**
 * /results 兼容壳：问卷完成流程仍 push /results?session=...
 * 这里把会话标识写入本地后跳转到「我的计划」Tab，真实内容已迁入 (tabs)/plan。
 */

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PaperCard } from "@/components/sketch";
import { storeSessionId } from "@/lib/supabase/client";

function ResultsRedirect() {
  const sp = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const sid = sp.get("session");
    if (sid) storeSessionId(sid);
    router.replace(sid ? "/plan" : "/");
  }, [sp, router]);

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <PaperCard className="p-8" tilt={1}>
        <p>正在翻到你的计划…</p>
      </PaperCard>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsRedirect />
    </Suspense>
  );
}
