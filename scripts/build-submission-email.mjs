// 生成提交邮件的 .eml 草稿（双击用邮件客户端打开即可发送；X-Unsent 标记使其成为可编辑草稿）
// 用法：node scripts/build-submission-email.mjs --name 张三
import fs from "node:fs";

const args = process.argv.slice(2);
const nameIdx = args.indexOf("--name");
const name = nameIdx >= 0 ? args[nameIdx + 1] : "【姓名】";
const date = "20260905";
const anon = fs.readFileSync(process.env.TEMP + "/anon-cloud.txt", "utf8").trim();

const to = "jin@arkon-tech.com, bin@arkon-tech.com, alex@arkon-tech.com, rip@arkon-tech.com";
const subject = `【${name}】_全栈挑战_${date}`;

const body = `各位好，

这是我的全栈挑战交付，按试题「交付物」清单逐项说明：

■ 1. 线上链接（公网可达，可完整演示）
https://betterme-jet-omega.vercel.app
（备用地址：https://better-me-jet-omega.vercel.app）
- 落地页 → 33 题问卷（分步保存 / 中断恢复 / 乱序与重复提交幂等）→ 服务端健康评估（BMI/BMR/摄入/预测曲线）→ 结果页脱敏 → 模拟支付解锁 30 天每日计划
- 已支付测试凭据（供直接对比付费前后差异化返回）：
    账号：review-1788576366@betterme-test.com
    密码：Review1234!
    已支付 sessionId：bad6c139-a501-4465-99d4-3bf28b02ddd6
- /pay 可重放 cURL：见附件文档第一节，或仓库 README「模拟支付重放」一节
- anon key（cURL 用）：${anon}

■ 2. 代码仓库
https://github.com/LosLiSang/better-me（公开）
- README 含：启动方式、迁移命令、API 重放脚本、数据库 Schema（Mermaid ER 图）、部署文档
- 提交历史按逻辑单元拆分（db / api / ui / ci），每个中间态可验证

■ 3. 自动化测试 + CI
- npm test：74 个单元测试（健康评估算法边界、答案交叉校验、进度推导、计划生成器）
- 25 项端到端：完整支付链路 + 非会员脱敏对比 + 支付幂等续期 + 越权访问 404
- GitHub Actions：每次推送自动执行 quality（tsc/lint/单测/build）+ integration（CI 内起真实 Supabase 栈重放迁移后跑 E2E），当前全绿：
  https://github.com/LosLiSang/better-me/actions
- CD 一并接入：迁移（dry-run 先行）→ 生产部署 → 生产冒烟，全程无人值守

■ 4. 数据库 Schema 图
README「数据库 Schema」：https://github.com/LosLiSang/better-me#数据库-schema
（4 表关系 + RLS 策略 + 幂等约束说明）

■ 5. AI 使用复盘
见附件文档第五节——包含三个我真实否决 AI 方案的案例与理由（e2e 重试策略、CI 冗余步骤、预测曲线渲染的数据诚实性），以及一个采纳 AI 建议的案例（模拟支付暴露面治理）。

■ 技术栈
Next.js 16 (App Router) + TypeScript + Supabase（Postgres / Auth 匿名登录 / RLS）+ Vitest + GitHub Actions

附件为交付说明全文（含覆盖场景清单、关键设计决策、暂未覆盖项及原因）。

期待各位的反馈。

${name}
`;

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const eml = [
  `To: ${to}`,
  `Subject: =?utf-8?B?${b64(subject)}?=`,
  "X-Unsent: 1",
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=utf-8",
  "Content-Transfer-Encoding: base64",
  "",
  b64(body),
  "",
].join("\r\n");

const out = `doc/提交/${subject}.eml`;
fs.mkdirSync("doc/提交", { recursive: true });
fs.writeFileSync(out, eml.replace(/^\uFEFF/, ""));
console.log("written:", out);
console.log("提示：双击 .eml 用邮件客户端打开 → 添加附件（同名 .md 导出的 PDF）→ 发送");
