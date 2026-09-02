# BetterMe Quiz Funnel — 观察记录

> 体验目标：理解数据流、每步产生的数据、哪些需持久化、订阅前后用户拿到什么。
> URL: https://betterme-pilates.com/first-page-brand-palette?flow=21171
> 体验日期：2026-09-02

## 访问路径与 URL 演变

1. 入口页 `/first-page-brand-palette?flow=21171` → 选择性别（Male / Female）
2. 选择性别后 → `/onboarding?flow=1453&order=<uuid>`（`order` 是本次会话的随机 UUID，即「会话/订单标识」）
3. 之后所有步骤都留在 `/onboarding`，通过前端状态机切换页面，**不改 URL**（SPA 内单步切换）

## 步骤结构（前端向后端「增量」发送的只有埋点事件）

产品结构 = 多步问答问卷（quiz），每一步一个或多个选择题。观察到的步骤（按顺序）：

1. **性别**：Male / Female（在入口页）
2. **年龄**：18-29 / 30-39 / 40-49 / 50+
3. 插页（social proof）："Over 1 million women in their 20s have already tried BetterMe" → CONTINUE
4. **主要目标**：Lose weight / Maintain weight and get fit
5. 插页（motivation）："We know how to make that happen!" → CONTINUE
6. **体型（physical build）**：Slim / Mid-sized / Full-figured / Extended size
7. **梦想身材（dream body）**：Thin / Toned / Curvy / Average
8. **体重变化规律**：gain fast lose slow / gain-lose easily / struggle to gain
9. **上次最佳身材时间**：<1 年 / 1-2 年 / >3 年 / Never
10. **导致增重的近期事件（多选）**：Work pressure / Busy family life / Divorce or breakup / Slower metabolism / Financial challenges / Covid-19 / Other stressful events / None → **NEXT STEP**
11. 插页（motivation）："Let's get you to your best shape ever!" → CONTINUE
12. **额外目标（多选）**：Build muscle strength / Improve posture / Reduce stress / Develop flexibility / None

之后还有：身高、体重、目标体重、运动频率等（题目要的「身体数据」应在更靠后的步骤，问卷很长，每个选项自动进下一步或点 NEXT STEP 确认）。

## 关键数据流洞察

### 客户端持有 vs 持久化
- 问卷答案**大部分先在前端 state 里累积**，不是每步都 POST 到业务接口。
- 每步真正发出的请求是**埋点/分析事件**：`/api/monitoring/otel/metrics/user_changed_onboarding_step_N`（step 1..10+ 依序递增）。这属于**遥测**，不是业务数据持久化。
- 一个 `order=<uuid>` 标识贯穿整次会话，用作会话/用户标识（题目里要求的「随机 UserID / 简易 Session 识别」与此一致）。

### 业务数据何时落库
- 完整问卷（含身高/体重/目标/频率）在**最后统一提交**，后端据此计算健康评估结果。
- 结果按**订阅状态**差异化返回：非会员拿脱敏/部分 + 提示付费；会员拿完整（预测曲线等）。
- `/pay` 回调后 `subscription_status` 置为有效，结果页由「脱敏」变「完整」。

### 对后端建模的映射
| 题目要求 | BetterMe 做法 | 我们的设计方向 |
|---|---|---|
| 分步保存接口 | 每步只发埋点，答案暂存前端 | 每步增量 POST 到后端，支持进度恢复 |
| 进度恢复 | `order` uuid 标识会话 | 用 sessionId，回填已填字段 |
| 服务端计算 | 提交后算 BMI/摄入量/预测日期 | 服务端算法，持久化关联用户 |
| 订阅鉴权 | `subscription_status` 脱敏 vs 完整 | 结果接口校验 + 差异化返回 |
| 模拟支付 | `/pay` 回调改状态 | `/pay` 接口改 `subscription_status` |

## 可复用的 UX 模式（竞品供参考，不要求复刻）
- 首屏直接问性别（低门槛进入）
- 每题单/多选 + 圆形 radio 卡片，选项即按钮
- 每 2-4 题插一个「社交证明 / 动机」整页插页，制造代入感与承诺
- 全程进度提示（step 计数），但无强制进度条
- 结尾自然引向付费（目标：让用户一路填到付费弹窗）

---

## 前端体验要求（本地定案 2026-09-02）

> 核心不是「表单能不能跑」，而是**节奏与反馈**——让用户愿意一路填到付费弹窗。

### 反馈力度：轻量语气反馈（已确认）
- 单选步骤：用户选完答案，**立即**给一句贴合所选内容的针对性文案（复述选择 + 鼓励/洞察），再自动进下一步。
- 语料需按选项差异化，不能千篇一律 —— 例：
  - 选「增重慢」→ "这正是我们最擅长处理的，很多人卡在这个点上。"
  - 选「工作压力大」→ "压力型增重很常见，我们会把它纳入你的方案。"
- 制造"有来有回"，节奏快、情感真实，避免纯表单单调。

### 付费墙：展示脱敏 vs 完整 + 可模拟 pay（已确认）
- 结果页**真实呈现脱敏态**：非会员看到预测曲线打码 + 「解锁完整方案」付费提示。
- 提供**模拟支付按钮**：触发 `/pay`，成功后结果页刷新为**完整态**（曲线解锁、字段齐全）。
- 给用户直观的「脱敏 → 完整」变化，最好能对比。

### 节奏设计要点
- 每步一个选择题，选项即按钮，选中即反馈并推进。
- 自然引向付费弹窗/结果页，不在细节上过度堆砌，聚焦"愿意填到底"。
- 关键节点（如最后一步、结果页）可补一句 motivation 收束。
