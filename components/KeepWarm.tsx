"use client";

import { useEffect } from "react";

const INTERVAL_MS = 25_000;

/** 客户端 keep-warm：定时 ping /api/ping，保持 Vercel serverless 函数热态（减弱冷启动卡顿） */
export default function KeepWarm() {
  useEffect(() => {
    const id = setInterval(() => {
      fetch("/api/ping", { cache: "no-store" }).catch(() => {});
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  return null;
}
