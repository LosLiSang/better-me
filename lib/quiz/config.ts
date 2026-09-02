import { QUIZ_VERSION, QuizQuestion } from "./types";

/** 题库（原创中文 33 题 v1） */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ── 核心计算（7） ─────────────────────────────────────────────
  {
    key: "gender",
    type: "single",
    question: "你的性别？",
    required: true,
    forCalculation: true,
    options: [
      { value: "male", label: "男", feedback: "收到，我们会按男性参数校准评估。" },
      { value: "female", label: "女", feedback: "收到，我们会按女性参数校准评估。" },
    ],
  },
  {
    key: "age",
    type: "single",
    question: "你的年龄段？",
    required: true,
    forCalculation: true,
    options: [
      { value: "18-29", label: "18-29 岁", feedback: "代谢旺盛，正是打基础的黄金期。" },
      { value: "30-39", label: "30-39 岁", feedback: "这个阶段稳住代谢是重点，我们帮你把关。" },
      { value: "40-49", label: "40-49 岁", feedback: "年龄不是问题，科学调整比蛮练更有效。" },
      { value: "50+", label: "50 岁以上", feedback: "我们会在方案里特别注意安全与温和。" },
    ],
  },
  {
    key: "goal",
    type: "single",
    question: "你的主要目标是什么？",
    required: true,
    forCalculation: true,
    options: [
      { value: "lose_weight", label: "减重", feedback: "减重是我们最擅长的，后面的建议会围绕它展开。" },
      { value: "maintain", label: "保持体重和健康", feedback: "保持也是一种能力，我们会帮你稳住状态。" },
    ],
  },
  {
    key: "height",
    type: "number",
    question: "你的身高是多少？",
    required: true,
    forCalculation: true,
    numeric: { min: 100, max: 250, unit: "cm" },
  },
  {
    key: "weight",
    type: "number",
    question: "你的体重是多少？",
    required: true,
    forCalculation: true,
    numeric: { min: 30, max: 250, unit: "kg" },
  },
  {
    key: "target_weight",
    type: "number",
    question: "你的目标体重是多少？",
    required: true,
    forCalculation: true,
    numeric: { min: 30, max: 250, unit: "kg", compareTo: { key: "weight", op: "lte" } },
  },
  {
    key: "activity_frequency",
    type: "single",
    question: "你每周平均运动几次？",
    required: true,
    forCalculation: true,
    options: [
      { value: "sedentary", label: "几乎不运动", feedback: "没关系，我们从低强度开始，循序渐进。" },
      { value: "light", label: "1-2 次", feedback: "有基础就好，我们帮你把频率调到更舒服的节奏。" },
      { value: "moderate", label: "3-4 次", feedback: "不错的习惯，我们在强度上帮你精进。" },
      { value: "active", label: "5 次以上", feedback: "已经很有运动习惯，我们会帮你优化效率。" },
    ],
  },

  // ── 身体与历史（6） ───────────────────────────────────────────
  {
    key: "physical_build",
    type: "single",
    question: "你如何描述自己的体型？",
    required: false,
    forCalculation: false,
    options: [
      { value: "slim", label: "偏瘦", feedback: "偏瘦体型，我们会侧重力量与线条塑造。" },
      { value: "mid", label: "匀称", feedback: "匀称是很好的起点，我们帮你更上一层。" },
      { value: "full", label: "丰满", feedback: "丰满也有它的美，重点是健康和自信。" },
      { value: "extended", label: "偏壮", feedback: "偏壮的底子力量强，塑形空间很大。" },
    ],
  },
  {
    key: "dream_body",
    type: "single",
    question: "你理想的体态是？",
    required: false,
    forCalculation: false,
    options: [
      { value: "thin", label: "纤细", feedback: "纤细的方向，我们会控制热量同时保住线条。" },
      { value: "toned", label: "紧致有型", feedback: "紧致是很多人的目标，训练和饮食我们都会兼顾。" },
      { value: "curvy", label: "曲线", feedback: "曲线美，我们会重点照顾塑形。" },
      { value: "average", label: "自然匀称", feedback: "自然匀称最舒服，我们帮你保持。" },
    ],
  },
  {
    key: "weight_change",
    type: "single",
    question: "你的体重通常怎么变化？",
    required: false,
    forCalculation: false,
    options: [
      { value: "gain_fast_lose_slow", label: "增重快但减得慢", feedback: "这正是我们最擅长处理的，很多人卡在这个点上。" },
      { value: "gain_lose_easy", label: "增减都容易", feedback: "你的代谢很灵活，调整方案见效会很快。" },
      { value: "struggle_gain", label: "难增重也难长肌肉", feedback: "我们会把重点放在增肌和力量上。" },
    ],
  },
  {
    key: "best_shape_ago",
    type: "single",
    question: "你上次状态最好的身材是什么时候？",
    required: false,
    forCalculation: false,
    options: [
      { value: "lt_1y", label: "一年以内", feedback: "底子还在，找回状态不难。" },
      { value: "1_2y", label: "1-2 年前", feedback: "两年内，完全来得及恢复。" },
      { value: "gt_3y", label: "3 年以上", feedback: "隔得久一点，我们会更耐心地慢慢找回。" },
      { value: "never", label: "一直没达到过", feedback: "那就从零开始，我们会陪你一步步来。" },
    ],
  },
  {
    key: "weight_gain_causes",
    type: "multi",
    question: "近年有哪些因素可能影响了你的体重？",
    required: false,
    forCalculation: false,
    options: [
      { value: "work_pressure", label: "工作压力", feedback: "压力型变化很常见，我们会把应对纳入方案。" },
      { value: "family", label: "家庭事务", feedback: "家庭节奏影响饮食很正常，我们帮你理顺。" },
      { value: "metabolism", label: "代谢放缓", feedback: "代谢放缓不是借口，科学调整可以改善。" },
      { value: "financial", label: "经济压力", feedback: "我们会在低成本可执行上多做考虑。" },
      { value: "other_stress", label: "其他压力事件", feedback: "情绪和压力我们都会一起处理。" },
      { value: "none", label: "以上都不是", feedback: "很好，那我们从你当前的状态开始就好。", exclusive: true },
    ],
  },
  {
    key: "other_goals",
    type: "multi",
    question: "除了主要目标，你还希望达成哪些？",
    required: false,
    forCalculation: false,
    options: [
      { value: "muscle", label: "增强力量", feedback: "增肌和力量是很好的附加目标。" },
      { value: "posture", label: "改善体态", feedback: "体态改善会让你整个人更有精神。" },
      { value: "less_stress", label: "缓解压力", feedback: "运动对减压很有帮助，我们会安排进去。" },
      { value: "flexibility", label: "提升柔韧性", feedback: "柔韧性是健康的重要一环。" },
      { value: "none", label: "以上都不是", feedback: "好的，专注你的主要目标就好。", exclusive: true },
    ],
  },

  // ── 运动与体能（8） ───────────────────────────────────────────
  {
    key: "daily_activity",
    type: "single",
    question: "你日常大多处于什么状态？",
    required: false,
    forCalculation: false,
    options: [
      { value: "sedentary", label: "久坐为主", feedback: "久坐很常见，我们会在方案里安排间隙活动。" },
      { value: "light", label: "轻度走动", feedback: "有轻度活动，在此基础上提升不难。" },
      { value: "active", label: "经常站立/走动", feedback: "日常活动量大，是个好基础。" },
    ],
  },
  {
    key: "energy_levels",
    type: "single",
    question: "你白天的精力水平如何？",
    required: false,
    forCalculation: false,
    options: [
      { value: "low", label: "偏低，容易疲惫", feedback: "精力不足会影响执行，我们会从休息和饮食入手。" },
      { value: "average", label: "一般", feedback: "正常水平，调整空间充足。" },
      { value: "high", label: "充沛", feedback: "精力好，适合更积极的训练安排。" },
    ],
  },
  {
    key: "walk_freq",
    type: "single",
    question: "你平时多久散一次步？",
    required: false,
    forCalculation: false,
    options: [
      { value: "daily", label: "几乎每天", feedback: "散步习惯很好，是你的优势。" },
      { value: "few", label: "每周几次", feedback: "有一定频率，我们帮你保持稳定。" },
      { value: "rare", label: "很少", feedback: "从每天几分钟的散步开始也很有效。" },
    ],
  },
  {
    key: "exercise_freq",
    type: "single",
    question: "你目前的运动频率是？",
    required: false,
    forCalculation: false,
    options: [
      { value: "daily", label: "几乎每天", feedback: "高频率，注意别过度，我们会帮你规划。" },
      { value: "few_week", label: "每周几次", feedback: "不错的节奏，我们帮你优化安排。" },
      { value: "rare", label: "很少", feedback: "没关系，我们帮你从小目标开始。" },
    ],
  },
  {
    key: "exercise_time",
    type: "single",
    question: "你每次能抽出多少时间运动？",
    required: false,
    forCalculation: false,
    options: [
      { value: "10_20", label: "10-20 分钟", feedback: "时间不多但很值得，短时高效我们来做。" },
      { value: "20_40", label: "20-40 分钟", feedback: "这个时长很理想，能完成不少训练。" },
      { value: "gt_40", label: "40 分钟以上", feedback: "时间充足，可以安排更充分的训练。" },
    ],
  },
  {
    key: "desired_freq",
    type: "single",
    question: "你希望每周运动几次？",
    required: false,
    forCalculation: false,
    options: [
      { value: "1_3", label: "1-3 次", feedback: "循序渐进很好，我们按这个节奏来。" },
      { value: "3_5", label: "3-5 次", feedback: "这个频率效果很稳，我们帮你排好。" },
      { value: "gt_5", label: "5 次以上", feedback: "高目标，我们会帮你在保证不受伤的前提下推进。" },
    ],
  },
  {
    key: "preferred_time",
    type: "multi",
    question: "你更倾向于什么时段运动？",
    required: false,
    forCalculation: false,
    options: [
      { value: "morning", label: "早晨", feedback: "早晨运动能开启一天好状态。" },
      { value: "midday", label: "中午", feedback: "中午抽空运动也很不错。" },
      { value: "afternoon", label: "下午", feedback: "下午是体能较好的时段。" },
      { value: "evening", label: "晚上", feedback: "晚上运动注意别太晚影响睡眠。" },
    ],
  },
  {
    key: "workout_comfort",
    type: "single",
    question: "运动过程中你是否常感到不适？",
    required: false,
    forCalculation: false,
    options: [
      { value: "yes", label: "经常", feedback: "我们会特别留意强度，避免让你难受。" },
      { value: "sometimes", label: "偶尔", feedback: "偶尔不适我们会帮你调整动作。" },
      { value: "no", label: "从不", feedback: "状态很好，我们可以大胆推进。" },
    ],
  },

  // ── 健康与限制（5） ───────────────────────────────────────────
  {
    key: "shortness_breath",
    type: "single",
    question: "你出现呼吸急促的频率？",
    required: false,
    forCalculation: false,
    options: [
      { value: "often", label: "经常", feedback: "我们会降低初始强度，循序渐进。" },
      { value: "sometimes", label: "偶尔", feedback: "注意观察，强度我们会保守一些。" },
      { value: "never", label: "从不", feedback: "心肺基础不错，可以放心安排。" },
    ],
  },
  {
    key: "discomfort_areas",
    type: "multi",
    question: "哪些部位容易让你不适？",
    required: false,
    forCalculation: false,
    options: [
      { value: "knee", label: "膝盖", feedback: "膝盖不适我们会避开高冲击动作。" },
      { value: "back", label: "腰背部", feedback: "腰背需要我们特别注意核心保护。" },
      { value: "shoulder", label: "肩颈", feedback: "肩颈不适我们会调整姿势和动作。" },
      { value: "none", label: "没有", feedback: "很好，那我们正常推进。", exclusive: true },
    ],
  },
  {
    key: "sleep_quality",
    type: "single",
    question: "你的睡眠质量如何？",
    required: false,
    forCalculation: false,
    options: [
      { value: "good", label: "很好", feedback: "睡眠好是恢复的保障。" },
      { value: "fair", label: "一般", feedback: "我们会把作息调整也纳入考虑。" },
      { value: "poor", label: "较差", feedback: "先改善睡眠，运动效果的根基才稳。" },
    ],
  },
  {
    key: "stress_level",
    type: "single",
    question: "你目前的压力水平如何？",
    required: false,
    forCalculation: false,
    options: [
      { value: "low", label: "较低", feedback: "压力不大，心态好是优势。" },
      { value: "moderate", label: "中等", feedback: "正常压力，我们帮你平衡。" },
      { value: "high", label: "较高", feedback: "我们会把减压和温和运动放在优先。" },
    ],
  },
  {
    key: "injury_history",
    type: "multi",
    question: "你是否有过以下部位的伤病史？",
    required: false,
    forCalculation: false,
    options: [
      { value: "knee", label: "膝盖", feedback: "有膝伤史我们会格外小心。" },
      { value: "back", label: "腰背", feedback: "腰背伤史需要谨慎安排受力。" },
      { value: "shoulder", label: "肩部", feedback: "肩部伤史我们会调整动作范围。" },
      { value: "none", label: "没有", feedback: "没有伤病史的话，可以放心开始。", exclusive: true },
    ],
  },

  // ── 营养与情绪（7） ───────────────────────────────────────────
  {
    key: "nutrition_habit",
    type: "single",
    question: "你如何评价自己目前的饮食习惯？",
    required: false,
    forCalculation: false,
    options: [
      { value: "healthy", label: "比较健康", feedback: "底子好，我们帮你优化细节。" },
      { value: "okay", label: "还可以", feedback: "有改善空间，我们逐步调整。" },
      { value: "needs_work", label: "需要改善", feedback: "没关系，从今天的小改变开始。" },
    ],
  },
  {
    key: "food_cravings",
    type: "multi",
    question: "你最容易渴望哪类食物？",
    required: false,
    forCalculation: false,
    options: [
      { value: "sweet", label: "甜食", feedback: "甜食渴望可以用健康方式替代。" },
      { value: "carb", label: "碳水", feedback: "碳水不是敌人，关键是选择和量。" },
      { value: "salty", label: "咸味", feedback: "注意钠摄入，我们会帮你搭配。" },
      { value: "fried", label: "油炸", feedback: "油炸解馋但要有度，我们帮你平衡。" },
      { value: "none", label: "没有特别偏好", feedback: "很好，那我们在均衡上多下功夫。", exclusive: true },
    ],
  },
  {
    key: "meal_planning",
    type: "single",
    question: "你通常如何规划三餐？",
    required: false,
    forCalculation: false,
    options: [
      { value: "planned", label: "提前计划", feedback: "有计划是很好的习惯。" },
      { value: "spontaneous", label: "随性决定", feedback: "随性也 OK，我们会帮你建立简单框架。" },
      { value: "skip", label: "常跳过某餐", feedback: "跳餐容易影响代谢，我们帮你找回节奏。" },
    ],
  },
  {
    key: "diet_type",
    type: "single",
    question: "你更偏好哪种饮食方式？",
    required: false,
    forCalculation: false,
    options: [
      { value: "traditional", label: "传统均衡饮食", feedback: "均衡最稳，我们在这个基础上优化。" },
      { value: "keto", label: "低碳/生酮", feedback: "生酮需要专业指导，我们会给出注意点。" },
      { value: "vegan", label: "素食/纯素", feedback: "素食我们重点确保蛋白质和维生素。" },
      { value: "intermittent", label: "间歇断食", feedback: "断食要配合身体状态，我们会适当引导。" },
    ],
  },
  {
    key: "fasting_knowledge",
    type: "single",
    question: "你对间歇性断食了解多少？",
    required: false,
    forCalculation: false,
    options: [
      { value: "none", label: "完全不了解", feedback: "没关系，我们从基础讲起。" },
      { value: "some", label: "有一些了解", feedback: "有基础概念很好，我们帮你补全。" },
      { value: "expert", label: "比较熟悉", feedback: "看来你研究过，我们给进阶建议。" },
    ],
  },
  {
    key: "meals_per_day",
    type: "single",
    question: "你每天通常吃几餐？",
    required: false,
    forCalculation: false,
    options: [
      { value: "lt_3", label: "少于 3 餐", feedback: "餐数偏少，我们会帮你合理安排。" },
      { value: "3", label: "3 餐", feedback: "三餐规律很标准。" },
      { value: "gt_3", label: "3 餐以上", feedback: "多餐也 OK，关键是总量控制。" },
    ],
  },
  {
    key: "emotional_eating",
    type: "likert",
    question: "我常常在压力或情绪波动时进食",
    required: false,
    forCalculation: false,
    options: [
      { value: "1", label: "1（非常不同意）", feedback: "很好，情绪影响不大。" },
      { value: "2", label: "2", feedback: "情绪影响较轻，注意点就行。" },
      { value: "3", label: "3", feedback: "中等，我们会提醒你留意这个触发点。" },
      { value: "4", label: "4", feedback: "情绪进食较多见，我们会给替代办法。" },
      { value: "5", label: "5（非常同意）", feedback: "我们特别重视这点，会优先帮你处理。" },
    ],
  },
];

/** 必填的计算 key（结构测试断言这些都在题库里） */
export const REQUIRED_CALC_KEYS = [
  "gender",
  "age",
  "goal",
  "height",
  "weight",
  "target_weight",
  "activity_frequency",
] as const;

/** 按 key 取题 */
export function getQuestion(key: string): QuizQuestion | undefined {
  return QUIZ_QUESTIONS.find((q) => q.key === key);
}

export { QUIZ_VERSION };
