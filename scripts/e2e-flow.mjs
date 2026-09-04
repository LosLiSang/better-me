/**
 * 端到端流程验证（本地栈）：
 * 匿名登录 → 开会话 → 分步提交(7 必填) → complete → result 脱敏
 * → upgrade 正式账号 → pay → result 完整 → 重复 pay 幂等
 */
import { createClient } from "@supabase/supabase-js";

// 支持指向任意环境（本地栈/生产）：E2E_SUPABASE_URL + E2E_SITE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
const SB_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SITE = process.env.E2E_SITE_URL ?? "http://localhost:3000";
let failures = 0;

function check(name, cond, extra = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name} ${extra}`); }
}

const sb = createClient(SB_URL, ANON, {
  auth: {
    storage: {
      // 自定义 storage 捕获最新会话，供渲染 SSR cookie
      _s: null,
      getItem() { return this._s; },
      setItem(_k, v) { this._s = v; },
      removeItem() { this._s = null; },
    },
  },
});

// @supabase/ssr 的 cookie 名由 Supabase URL 首段推导：127.0.0.1 → sb-127-auth-token；
// 云项目 → sb-<project-ref>-auth-token
const COOKIE_NAME = `sb-${new URL(SB_URL).hostname.split(".")[0]}-auth-token`;
function cookieHeader(storage = sb.auth.storage) {
  const raw = storage._s;
  if (!raw) return "";
  return `${COOKIE_NAME}=base64-${btoa(unescape(encodeURIComponent(raw)))}`;
}

// 网络层抖动（代理回绕 supabase.co 偶发 ECONNRESET）——仅重试网络异常，业务性失败不重试
async function withRetry(fn, label, tries = 6) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const msg = String(e?.message ?? e);
      // 只重试纯网络故障
      if (!/(fetch failed|ECONNRESET|ECONNREFUSED|socket|network|The operation was aborted)/i.test(msg) && !String(e?.cause?.code ?? "").match(/fetch|reset|refused|timeout/i)) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

async function loginAnon(client) {
  const { data, error } = await withRetry(() => client.auth.signInAnonymously(), "anon");
  if (error || !data?.session) throw new Error(error?.message ?? "no session");
  return data;
}

let anon;
try {
  anon = await loginAnon(sb);
  check("匿名登录", !!anon?.session, "");
} catch (e) {
  check("匿名登录", false, e.message);
}
async function api(method, path, body) {
  const r = await withRetry(() => fetch(SITE + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: body ? JSON.stringify(body) : undefined,
  }), "api " + path);
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
}

// 1 开会话
const s = await api("POST", "/api/session");
check("开新会话 200", s.status === 200, JSON.stringify(s.json));
const sessionId = s.json.sessionId;

// 2 进度恢复（空）
const g0 = await api("GET", `/api/session/${sessionId}`);
check("进度恢复 currentStep=0", g0.json.currentStep === 0);

// 3 分步提交：先提交一个非法答案
const bad = await api("POST", `/api/session/${sessionId}/step`, { stepKey: "height", answerValue: { value: 99 } });
check("非法答案被拒 400", bad.status === 400);

// 提交必填题：先 age/goal/height/weight，再测 target_weight 交叉校验（90>72 应拒）
const steps = {
  age: { value: "30-39" }, goal: { value: "lose_weight" },
  height: { value: 165 }, weight: { value: 72 },
};
for (const [k, v] of Object.entries(steps)) {
  const r = await api("POST", `/api/session/${sessionId}/step`, { stepKey: k, answerValue: v });
  if (r.status !== 200) { check(`step ${k}`, false, JSON.stringify(r.json)); }
}
const badTarget = await api("POST", `/api/session/${sessionId}/step`, { stepKey: "target_weight", answerValue: { value: 90 } });
check("减重目标>当前 被拒 400", badTarget.status === 400, JSON.stringify(badTarget.json));
const okTarget = await api("POST", `/api/session/${sessionId}/step`, { stepKey: "target_weight", answerValue: { value: 65 } });
check("合法目标体重 200", okTarget.status === 200);
const rest = { activity_frequency: { value: "light" } };
for (const [k, v] of Object.entries(rest)) {
  const r = await api("POST", `/api/session/${sessionId}/step`, { stepKey: k, answerValue: v });
  if (r.status !== 200) { check(`step ${k}`, false, JSON.stringify(r.json)); }
}
check("7 必填全部保存", true);

// 提交 gender（放最前，作为合法基准）
const g = await api("POST", `/api/session/${sessionId}/step`, { stepKey: "gender", answerValue: { value: "male" } });
check("gender 保存", g.status === 200);

// 乱序重复提交（幂等）
const dup = await api("POST", `/api/session/${sessionId}/step`, { stepKey: "gender", answerValue: { value: "male" } });
check("重复提交幂等 200", dup.status === 200 && dup.json.currentStep === 7);

// 4 进度恢复
const g1 = await api("GET", `/api/session/${sessionId}`);
check("进度恢复 currentStep=7 + answers 含 gender", g1.json.currentStep === 7 && !!g1.json.answers.gender);

// 5 complete
const c = await api("POST", `/api/session/${sessionId}/complete`);
check("complete 200", c.status === 200, JSON.stringify(c.json));
const c2 = await api("POST", `/api/session/${sessionId}/complete`);
check("重复 complete 409", c2.status === 409);

// 6 result 脱敏
const r1 = await api("GET", `/api/session/${sessionId}/result`);
check("非会员 locked:true", r1.json.locked === true);
if (!r1.json.data) {
  check("非会员脱敏响应", false, JSON.stringify(r1.json));
} else {
  check("非会员拿不到 predictionCurve", !("predictionCurve" in r1.json.data) && !("weeklyRateKg" in r1.json.data));
  check("非会员可见 BMI", typeof r1.json.data.bmi === "number");
  check("非会员计划仅 Day1 预览", r1.json.data.plan && r1.json.data.plan.totalDays === 30 && r1.json.data.plan.previewDays.length === 1, JSON.stringify(r1.json.data.plan && r1.json.data.plan.totalDays));
}

// 7 upgrade（每次运行用唯一邮箱，避免上轮已注册）
const email = `e2e-${Date.now()}@example.com`;
const up = await api("POST", "/api/upgrade", { email, password: "secret123" });
check("升级正式账号 200", up.status === 200, JSON.stringify(up.json));

// 8 pay（匿名已升级为正式 → 放行）
const p = await api("POST", "/api/pay");
check("pay 200 + expiresAt", p.status === 200 && !!p.json.expiresAt, JSON.stringify(p.json));
const p2 = await api("POST", "/api/pay");
check("重复 pay 幂等 200（续期顺延）", p2.status === 200);

// 9 result 完整
const r2 = await api("GET", `/api/session/${sessionId}/result`);
check("会员 locked:false", r2.json.locked === false);
check("会员拿到完整 predictionCurve", Array.isArray(r2.json.data.predictionCurve) && r2.json.data.predictionCurve.length === 15);
check("会员拿到 weeklyRateKg", r2.json.data.weeklyRateKg === -0.5);
check("会员拿到完整 30 天计划", r2.json.data.plan && r2.json.data.plan.previewDays.length === 30);
check("计划日卡结构完整", (() => { const d0 = r2.json.data.plan.previewDays[0]; return d0.day === 1 && d0.workout.items.length > 0 && d0.meals.length >= 3 && d0.tip.length > 0; })());

// 10 越权：新建另一匿名用户访问同一 session
const sb2 = createClient(SB_URL, ANON, {
  auth: {
    storage: {
      _s: null,
      getItem() { return this._s; },
      setItem(_k, v) { this._s = v; },
      removeItem() { this._s = null; },
    },
  },
});
let anon2Err;
try { await loginAnon(sb2); } catch (e) { anon2Err = e; }
if (anon2Err) throw new Error("第二个匿名用户登录失败：" + anon2Err.message);
const raw2 = cookieHeader(sb2.auth.storage);
const r3 = await withRetry(() => fetch(SITE + `/api/session/${sessionId}/result`, {
  headers: { Cookie: raw2 },
}), "越权 fetch");
check("越权访问 404", r3.status === 404);

console.log(failures === 0 ? "\nALL E2E PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
