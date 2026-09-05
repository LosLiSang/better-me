# BetterMe

健身/健康测评 funnel：33 题问卷 → 服务端健康评估（BMI/BMR/摄入/预测曲线）→ 结果页（锁定/解锁差异化）→ 模拟订阅解锁 30 天每日计划。

**技术栈**：Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase（Postgres + Auth 匿名登录）

[![ci-cd](https://github.com/LosLiSang/better-me/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/LosLiSang/better-me/actions/workflows/ci-cd.yml)

**线上地址**：https://better-me-jet-omega.vercel.app

## 数据库 Schema

```mermaid
erDiagram
    auth_users ||--o{ assessment_session : "user_id"
    auth_users ||--o| subscription : "user_id (1:1)"
    assessment_session ||--o{ assessment_answer : "session_id"
    assessment_session ||--|| assessment_result : "session_id (1:1)"
    assessment_session {
        uuid id PK
        uuid user_id FK
        text status "in_progress | completed"
        int current_step "服务端推导，不信任客户端"
        text quiz_version
    }
    assessment_answer {
        uuid id PK
        uuid session_id FK
        text step_key
        jsonb answer_value
    }
    assessment_result {
        uuid id PK
        uuid session_id FK "UNIQUE，1:1"
        numeric bmi
        text bmi_category
        int recommended_calories
        date target_date
        jsonb prediction_curve
        text algorithm_version
    }
    subscription {
        uuid id PK
        uuid user_id FK "UNIQUE，1:1"
        text status "inactive | active"
        timestamptz expires_at
        text payment_event_id "UNIQUE，幂等"
        numeric amount
    }
```

要点：用户身份直接复用 `auth.users`（含匿名用户），不建业务用户表；`assessment_answer` 以 `UNIQUE(session_id, step_key)` 实现分步保存幂等；`subscription` 用户级 1:1、`payment_event_id` 唯一保支付幂等；全表启用 RLS 按 `auth.uid()` 隔离。

## 模拟支付重放（cURL）

```bash
SB=https://hvbudfagfzikefytjyqs.supabase.co
SITE=https://better-me-jet-omega.vercel.app
ANON=<云项目 anon key，见下方测试账号说明>

# 1. 密码登录拿 token（测试账号，见下）
RES=$(curl -s -X POST "$SB/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"<测试账号>","password":"<密码>"}')
AT=$(echo "$RES" | jq -r .access_token); RT=$(echo "$RES" | jq -r .refresh_token)

# 2. 拼 @supabase/ssr cookie（服务端由此识别用户）
COOKIE="sb-hvbudfagfzikefytjyqs-auth-token=base64-$(printf '{\"access_token\":\"%s\",\"refresh_token\":\"%s\",\"token_type\":\"bearer\"}' "$AT" "$RT" | base64 -w0)"

# 3. 已支付会话的会员完整结果
curl -s "$SITE/api/session/<已支付sessionId>/result" -H "Cookie: $COOKIE"

# 4. 重放支付回调（续期顺延，幂等）
curl -s -X POST "$SITE/api/pay" -H "Cookie: $COOKIE"
```

**内置测试账号（已支付）**：见提交材料；也可自行走一遍 funnel 后注册升级，效果等同。

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

## CI/CD（GitHub Actions）

`.github/workflows/ci-cd.yml` 五段流水线：

| Job | 内容 | 触发 |
|---|---|---|
| `quality` | tsc / lint / 74 单测 / build | push + PR |
| `integration` | CI 内起本地 Supabase 栈 → 25 项 E2E（仅本地栈） | push + PR |
| `migrate` | 生产迁移：`db push --dry-run` → `db push`（先迁移后部署） | master push，`ENABLE_CD=true` |
| `deploy` | Vercel prebuilt 部署（无 .git 临时目录执行） | master push，`ENABLE_CD=true` |
| `smoke` | 生产非破坏性冒烟：/api/ping、/ 200、未凭据 401 | deploy 成功后 |

**启用 CD（密钥只进 GitHub Secrets，不过手任何人/对话）：**

```bash
# ① 在 https://vercel.com/account/tokens 创建专用 CI token（选项目所在 team，设短有效期），然后：
gh secret set VERCEL_TOKEN
# ② Supabase Dashboard → Connect → Session pooler 连接串（含密码），然后：
gh secret set SUPABASE_DB_URL
# ③ 打开 CD 开关：
gh variable set ENABLE_CD --body true
```

安全设计：workflow 内零明文密钥（全部走 Secrets，日志自动掩码）；迁移用完整连接串 Secret（避免密码特殊字符拼 URI）；本地栈 anon key 运行时从 `supabase status` 提取而非硬编码；E2E 只打本地栈、生产只做非破坏性冒烟；deploy 在不含 `.git` 的临时目录执行。

## 架构与设计文档

见 `doc/架构设计.md`（路由闭环 / 脱敏策略 / 订阅模型）、`doc/问卷设计-v1.md`（33 题结构）。
