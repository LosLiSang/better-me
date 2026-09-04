import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** keep-warm 探活点：客户端定时 ping，让 Hobby 的 serverless 函数保持热态，减弱冷启动卡顿 */
export async function GET() {
  return NextResponse.json({ ok: true, t: Date.now() });
}
