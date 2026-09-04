# BetterMe

健身/健康测评 funnel：33 题问卷 → 服务端健康评估（BMI/BMR/摄入/预测曲线）→ 结果页（锁定/解锁差异化）→ 模拟订阅解锁 30 天每日计划。

**技术栈**：Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase（Postgres + Auth 匿名登录）

## 本地开发

```bash
# 1. 启动本地 Supabase 栈（需要 Docker Desktop）
npx supabase start

# 2. 配置环境变量
cp .env.example .env.local   # 本地栈默认值已内置（anon key 是标准本地演示密钥）

# 3. 安装依赖并启动
npm install
npm run dev                  # http://localhost:3000
```

## 数据库迁移

```bash
npx supabase db reset        # 本地：从零重放全部迁移（含 plan_30d）
npx supabase db push         # 云端：推送未应用的迁移（需先 login + link）
```

## 验证

```bash
npm test                     # 74 单测（vitest）
npm run lint
npm run build
# 端到端（需 dev server + 本地栈）：
set -a && . ./.env.local && set +a && node scripts/e2e-flow.mjs   # 25 项全流程
```

## Supabase Auth 设置

架构按「演示简化」设计，云端项目需手动确认两处（Dashboard → Authentication）：

- **匿名登录**：开启（`ensureSession` 依赖 `signInAnonymously`）
- **邮箱确认**：关闭（输入邮箱即生效；生产版应开启并走邮件验证）

## 部署（Vercel + Supabase 云）

1. Supabase 云项目 → `npx supabase login` → `npx supabase link --project-ref <ref>` → `npx supabase db push`
2. Vercel 导入 GitHub 仓库，配置环境变量（Production）：
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`：云项目 Settings → API
   - `DEMO_PAYMENT_ENABLED=true`：开放模拟支付（**默认关闭**，关闭时 `/api/pay` 返回 501「支付渠道暂未开通」）
3. Supabase Auth → Site URL 填 Vercel 生产域名

> ⚠️ `/api/pay` 是**模拟支付**：任何正式账号调用即解锁 30 天会员。UI 已明确标注，仅适用于演示定位；接真实支付前保持开关关闭。

## 架构与设计文档

见 `doc/架构设计.md`（路由闭环 / 脱敏策略 / 订阅模型）、`doc/问卷设计-v1.md`（33 题结构）。
