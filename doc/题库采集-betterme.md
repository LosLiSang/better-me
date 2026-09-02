# BetterMe Quiz — 题库采集（题目 + 选项实录）

> 来源：https://betterme-pilates.com/first-page-brand-palette?flow=21171（走完真实问卷流自动采集）
> 采集方式：agent-browser 自动推进，逐题记录 `h2 题目` + 选项按钮文本。
> 用途：作为本项目 `lib/quiz/config.ts` 题库设计的**参考素材**，不要求 1:1 复刻。

## 采集说明
- **采集来源声明**：本文档记录从 BetterMe 公开问卷流观察到的题目结构。⚠️ **并非「完整提取」**——部分多选题选项未能展开、若干题干描述为采得实况，标注如下：
  - `verified`：观察到的题目 + 完整选项（前端实际呈现）
  - `partial`：观察到题目，但选项未完整展开
  - `adapted`：本项目自行编写的原创选项（非 BetterMe 原文）
- 单选题：部分选项带 Icon 前缀（如 "Icon Slim"），这里去掉 Icon 前缀还原为可读文本。
- 多选题：勾选 checkbox，点 NEXT STEP；部分带 "None of the above"。
- 中间的整页插页（social proof / motivation）不是题目，仅作节奏参考。
- 身高等**数字输入**题（身高/体重/目标体重）不在按钮选项里，采不到；本项目按健康测评标准自写（adapted）。

> ⚠️ **重要**：本项目**不逐字克隆** BetterMe。题库为**原创中文 33 题**，仅借鉴其结构与题型分布。下方内容仅供结构参考，正式题库见 `doc/问卷设计-v1.md`。

---

## 一、入口与基础信息（前几题）

### 1. 性别（入口页）
- Male
- Female

### 2. 年龄（What's your age?）
- 18 - 29
- 30 - 39
- 40 - 49
- 50+

### 3. 主要目标（What's your main goal?）
- Lose weight
- Maintain weight and get fit

### 4. 体型（How would you describe your physical build?）
- Slim
- Mid-sized
- Full-figured
- Extended size

### 5. 梦想身材（What's your dream body?）
- Thin
- Toned
- Curvy
- Average

### 6. 体重变化规律（How does your weight typically change?）
- I gain weight fast but lose it slowly
- I gain and lose weight easily
- I struggle to gain weight or muscle

### 7. 上次最佳身材时间（How long ago were you in the best shape of your life?）
- Less than a year ago
- 1 to 2 years ago
- More than 3 years ago
- Never

### 8. 导致增重的近期事件（Have any of the following events led to weight gain in the last few years?）·多选
- Work pressure
- Busy family life
- Divorce or breakup
- Slower metabolism due to aging
- Financial challenges
- Covid-19 pandemic
- Other stressful events
- None of the above

### 9. 额外目标（What else do you hope to achieve with this plan?）·多选
- Build muscle strength
- Improve posture
- Reduce stress and worry
- Develop flexibility
- None of the above

---

## 二、运动与活动量

### 10. 日常活跃度（How active are you on a typical day?）
- I spend most of the day sitting
- （其余选项采集时未展开）

### 11. 白天精力水平（How are your energy levels during the day?）
- Low, I feel tired throughout the day

### 12. 散步频率（How often do you go for walks?）
- Almost every day

### 13. 运动频率（How often do you exercise?）
- Almost every day

### 14. 每天可运动时间（How much time do you have for exercise on a typical day?）
- 10-20 min

### 15. 期望运动频率（How often do you want to work out?）
- 1 - 3 times a week

### 16. 偏好的运动时段（What time of the day do you prefer to work out?）·多选
- Morning
- Midday
- Afternoon
- Evening

### 17. 目标区域（What are your target zones?）·多选
- （未展开，通常是身体部位）

---

## 三、健康状况

### 18. 呼吸急促频率（How often do you experience shortness of breath?）
- Very often

### 19. 运动时不适/紧张（Do you experience discomfort or tension when working out?）
- Yes

### 20. 以下哪些让你困扰（Do you struggle with any of the following?）·多选
- （未展开，通常膝盖/背部/关节等）

---

## 四、营养与饮食

### 21. 营养习惯（How would you describe your nutrition habits?）
- My diet is on point and I'd like to keep it that way

### 22. 以下哪些习惯（Do you have any of the following habits?）·多选
- （未展开）

### 23. 最常渴望的食物（What foods do you crave most often?）·多选
- （未展开）

### 24. 如何计划三餐（How do you typically plan your meals?）
- I eat without any planning

### 25. 偏好的饮食类型（What type of diet do you prefer?）
- Traditional

### 26. 如何准备餐食（How do you usually prepare your meals?）
- I cook them myself

### 27. 是否知道每日需热量（Do you know your daily calorie needs for your goal?）
- Yes

### 28. 记录热量难度（How difficult is it for you to count calories?）
- Extremely difficult

### 29. 对间歇性断食的了解（What do you know about intermittent fasting?）
- Nothing at all

### 30. 每天几餐（How many meals do you typically eat in a day?）
- Fewer than 3 meals

### 31. 首餐时间（When do you usually have your first meal of the day?）
- Before 6 AM

### 32. 末餐时间（When do you usually have your last meal of the day?）
- Before 6 PM

### 33. 压力/情绪对饮食的影响（How do stress and emotions affect your food choices?）·多选
- （未展开，checkbox 型）

---

## 五、节奏插页（非题目，仅参考）

- "Over 1 million women in their 20s have already tried BetterMe"（社交证明）
- "We know how to make that happen!"（动机）
- "Let's get you to your best shape ever!"（激励）
- "Just 10-20 minutes a day for major results!"（卖点）
- "Optimize nutrition with a personalized meal plan"（卖点）
- "Track your calorie intake effortlessly"（卖点）
- "What is fasting?"（科普插页）
- "Get slimmer and stronger day by day"（目标收束）

---

## 六、对本题库的映射建议

### 题目要求的核心字段（必配）
betterme 竞品把这些分散在问卷前段+后段。**题目明确要求**这些进计算：
- 性别（gender）— 入口
- 目标（goal）— main goal
- 年龄（age）
- 身高（height）— 数字输入
- 体重（weight）— 数字输入
- 目标体重（target_weight）— 数字输入
- 运动频率（activity_frequency）— 让"多久运动一次"

### 我们题库的取舍
题目说"不要求 1:1 复刻"，所以**不必**照搬 30+ 题。建议精简为**关键的 8-10 步**，每步都配轻量语气反馈（呼应你之前定的「足够的反馈」）：

| # | stepKey | 题目 | 选项（value / label） | 类型 | 用途 |
|---|---|---|---|---|---|
| 1 | gender | 你的性别 | male/female | 单选 | 入库/计算 |
| 2 | age | 你的年龄 | 18-29 / 30-39 / 40-49 / 50+ | 单选 | 计算 |
| 3 | goal | 你的主要目标 | lose_weight / maintain | 单选 | 计算 |
| 4 | height | 你的身高 | 数字(cm) | 输入 | 计算 BMI |
| 5 | weight | 你的体重 | 数字(kg) | 输入 | 计算 BMI |
| 6 | target_weight | 你的目标体重 | 数字(kg) | 输入 | 预测日期 |
| 7 | activity_frequency | 你每周运动几次 | sedentary/light/moderate/active | 单选 | 热量系数 |
| 8 | physical_build | 体型 | slim/mid/full/extended | 单选 | 反馈 |
| 9 | dream_body | 理想身材 | thin/toned/curvy/average | 单选 | 反馈 |
| 10 | nutrition | 饮食习惯 | on_point/needs_work | 单选 | 反馈 |

> 身体数值（height/weight/target_weight）用数字输入框（而非按钮选项），进度恢复仍走 `assessment_answer` 存储。
