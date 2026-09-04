/**
 * 30 天每日计划生成器（服务端纯函数，确定性）
 *
 * 会员核心价值内容：每天 = 主题 + 动作（focus/items/minutes）+ 三餐（按目标热量分配）+ 贴士。
 * 设计要点：
 * - 纯函数 + 零随机：同输入同输出（可测试、可重现、可缓存）
 * - 伤病史/不适过滤：knee/back/shoulder 剔除对应高风险动作
 * - 饮食类型：traditional/keto/vegan/intermittent 四套模板池
 * - 周期化：4 周递进（适应→巩固→进阶→冲刺），满足"值得付费"的内容密度
 *
 * 完整 30 天入库 assessment_result.plan_30d；API 层差异化：非会员仅 Day1。
 */

import type { AssessInput } from "../health/assess";

export const PLAN_VERSION = "v1";

export interface PlanExtras {
  /** 不适部位（discomfort_areas 多选） */
  discomforts: string[];
  /** 伤病史（injury_history 多选） */
  injuries: string[];
  dietType: string;
  mealsPerDay: string;
  cravings: string[];
  exerciseTime: string;
  desiredFreq: string;
}

export interface PlanInput {
  core: AssessInput;
  calories: number;
  extras: PlanExtras;
}

export interface PlanMeal {
  meal: "早餐" | "午餐" | "晚餐" | "加餐";
  desc: string;
  kcal: number;
}

export interface DayPlan {
  day: number;
  theme: string;
  workout: {
    focus: string;
    items: string[];
    minutes: number;
  };
  meals: PlanMeal[];
  tip: string;
}

export interface MonthPlan {
  version: string;
  days: DayPlan[];
}

// ── 动作模板池（按类别；剔除逻辑基于正则） ──────────────────────
const WORKOUT_POOL: Record<string, string[]> = {
  有氧燃脂: ["快走 20 分钟", "跳绳 3 组×100 次", "开合跳 4 组×40 次", "高抬腿 4 组×30 秒", "登山跑 4 组×30 秒", "波比跳 3 组×10 次", "骑行/椭圆机 25 分钟"],
  下肢塑形: ["徒手深蹲 4 组×15 次", "弓步蹲 3 组×12 次/侧", "臀桥 4 组×15 次", "保加利亚分腿蹲 3 组×10 次/侧", "靠墙静蹲 3 组×45 秒", "深蹲跳 3 组×12 次"],
  上肢与核心: ["跪姿俯卧撑 4 组×10 次", "平板支撑 4 组×40 秒", "侧平板 3 组×30 秒/侧", "死虫式 3 组×12 次/侧", "鸟狗式 3 组×12 次/侧", "哑铃推举 3 组×12 次", "哑铃划船 3 组×12 次/侧"],
  全身循环: ["深蹲+俯卧撑+登山跑 循环 4 轮", "波比跳+平板支撑 循环 4 轮", "壶铃摆动+弓步蹲 循环 4 轮", "跳绳+卷腹+臀桥 循环 5 轮"],
  柔韧恢复: ["全身拉伸 15 分钟", "瑜伽拜日式 5 轮", "泡沫轴放松 10 分钟", "腹式呼吸+冥想 10 分钟"],
};

/** 伤病 → 禁用动作正则 */
const INJURY_BAN: Record<string, RegExp> = {
  knee: /深蹲跳|跳绳|弓步跳|波比跳|开合跳|登山跑|高抬腿|分腿蹲|靠墙静蹲/,
  back: /硬拉|体前屈|仰卧起坐|壶铃摆动/,
  shoulder: /俯卧撑|推举|平板/,
};
/** 不适部位沿用同样的禁用表 */
const DISCOMFORT_BAN: Record<string, RegExp> = INJURY_BAN;

/** 每周节奏（7 天模式）：按期望频率决定休息日数 */
function weeklyPattern(desiredFreq: string): string[] {
  // R=恢复日
  if (desiredFreq === "1_3") return ["练", "R", "练", "R", "R", "练", "R"];
  if (desiredFreq === "gt_5") return ["练", "练", "练", "R", "练", "练", "练"];
  return ["练", "练", "R", "练", "练", "R", "练"]; // 3-5
}

const TRAIN_CATS = ["有氧燃脂", "下肢塑形", "上肢与核心", "全身循环", "有氧燃脂", "下肢塑形", "全身循环"];

function minutesOf(exerciseTime: string): number {
  if (exerciseTime === "10_20") return 15;
  if (exerciseTime === "gt_40") return 45;
  return 30;
}

/** 剔除禁用动作后，从类别池取 n 项（确定性） */
function pickItems(cat: string, n: number, banned: RegExp[]): string[] {
  const pool = (WORKOUT_POOL[cat] ?? []).filter((it) => !banned.some((b) => b.test(it)));
  const src = pool.length > 0 ? pool : WORKOUT_POOL["柔韧恢复"];
  return Array.from({ length: n }, (_, i) => src[i % src.length]);
}

// ── 饮食模板池（按类型） ────────────────────────────────────────
interface MealTemplate {
  breakfast: string[];
  lunch: string[];
  dinner: string[];
  snack: string[];
}
const MEAL_POOL: Record<string, MealTemplate> = {
  traditional: {
    breakfast: ["燕麦粥 + 水煮蛋 + 脱脂奶", "全麦面包 + 煎蛋 + 无糖豆浆", "杂粮粥 + 蒸蛋 + 小番茄", "玉米 + 酸奶 + 坚果一小把"],
    lunch: ["糙米饭 + 香煎鸡胸 + 西兰花", "杂粮饭 + 清蒸鱼 + 凉拌菠菜", "荞麦面 + 卤牛肉 + 凉拌黄瓜", "红薯 + 虾仁炒蛋 + 白灼生菜"],
    dinner: ["小米粥 + 豆腐 + 清炒时蔬", "紫薯 + 三文鱼沙拉", "魔芋面 + 鸡丝 + 时蔬", "冬瓜汤 + 瘦猪肉 + 西葫芦"],
    snack: ["苹果一个", "无糖酸奶一杯", "小番茄一把", "坚果 10 克"],
  },
  keto: {
    breakfast: ["煎蛋两枚 + 培根 + 牛油果", "芝士蛋饼 + 黑咖啡", "烟熏三文鱼 + 奶酪", "防弹咖啡 + 水煮蛋"],
    lunch: ["香煎牛排 + 黄油西兰花", "烤鸡腿 + 芝士沙拉", "五花肉片 + 炒芦笋", "三文鱼 + 蒜蓉菠菜"],
    dinner: ["黄油煎虾 + 凉拌蘑菇", "牛油果鸡肉沙拉", "羊排 + 烤蔬菜", "芝士汉堡肉饼 + 生菜"],
    snack: ["奶酪一片", "夏威夷果 8 颗", "黑巧克力 85% 两小块", "煮蛋一枚"],
  },
  vegan: {
    breakfast: ["燕麦奶粥 + 奇亚籽 + 蓝莓", "全麦吐司 + 鹰嘴豆泥", "豆浆 + 蒸南瓜 + 核桃", "藜麦粥 + 香蕉"],
    lunch: ["糙米饭 + 麻婆豆腐 + 时蔬", "鹰嘴豆咖喱 + 糙米饭", "藜麦沙拉 + 烤蔬菜", "荞麦面 + 香菇浇头"],
    dinner: ["蔬菜味噌汤 + 卤豆干", "红薯 + 凉拌木耳 + 炒时蔬", "蔬菜糙米粥 + 凉拌豆腐", "南瓜浓汤 + 全麦馒头半个"],
    snack: ["香蕉一根", "豆浆一杯", "混合坚果一小把", "橙子一个"],
  },
  intermittent: {
    breakfast: ["（进食窗口 12:00 开始）黑咖啡 + 水", "（窗口外）无糖茶 + 柠檬水", "（进食窗口开始）杂粮粥 + 蛋", "（窗口外）气泡水"],
    lunch: ["（开窗第一餐）糙米饭 + 鸡胸 + 西兰花", "杂粮饭 + 清蒸鱼 + 凉菜", "荞麦面 + 卤牛肉 + 黄瓜", "红薯 + 虾仁炒蛋 + 生菜"],
    dinner: ["（窗口末餐）蛋白质 + 时蔬 + 少量主食", "豆腐 + 清炒时蔬 + 小米粥", "三文鱼沙拉 + 紫薯", "魔芋面 + 鸡丝 + 时蔬"],
    snack: ["（窗口内）无糖酸奶", "（窗口内）坚果 10 克", "（窗口内）苹果半个", "（窗口外）无糖茶"],
  },
};

/** 热量分配比例（三餐 + 加餐） */
const SPLIT_3 = { 早餐: 0.3, 午餐: 0.4, 晚餐: 0.25, 加餐: 0.05 };
const SPLIT_2 = { 早餐: 0.35, 午餐: 0.45, 晚餐: 0.2, 加餐: 0 };
const SPLIT_4 = { 早餐: 0.27, 午餐: 0.33, 晚餐: 0.22, 加餐: 0.18 }; // 两次加餐合计

function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

const TIPS = [
  "饭前喝一杯水，能自然减少食量。",
  "今晚早点睡：睡眠不足会让第二天更想吃高热量。",
  "细嚼慢咽，每口 15 次以上，饱腹信号需要 20 分钟。",
  "今天量一次晨起体重并记录，只和上周比。",
  "爬楼梯代替电梯，碎片消耗也是消耗。",
  "嘴馋时先喝无糖茶，等 10 分钟再决定。",
  "蛋白质优先：每餐先吃蛋白质再吃主食。",
  "准备第二天的食材，减少临时外卖的概率。",
];

const THEME_BY_WEEK = ["适应期", "巩固期", "进阶期", "冲刺期"];

export function generateMonthPlan(input: PlanInput): MonthPlan {
  const { calories, extras } = input;
  const banned: RegExp[] = [];
  for (const k of [...extras.injuries, ...extras.discomforts]) {
    const ban = INJURY_BAN[k] ?? DISCOMFORT_BAN[k];
    if (ban) banned.push(ban);
  }

  const pattern = weeklyPattern(extras.desiredFreq);
  const minutes = minutesOf(extras.exerciseTime);
  const nItems = minutes <= 15 ? 2 : 3;

  const meals = MEAL_POOL[extras.dietType] ?? MEAL_POOL["traditional"];
  const split = extras.mealsPerDay === "lt_3" ? SPLIT_2 : extras.mealsPerDay === "gt_3" ? SPLIT_4 : SPLIT_3;
  const twoSnacks = extras.mealsPerDay === "gt_3";

  const days: DayPlan[] = [];
  for (let i = 0; i < 30; i++) {
    const day = i + 1;
    const week = Math.floor(i / 7); // 0..3（第29/30天归第4周尾）
    const dow = i % 7;

    let focus: string;
    let items: string[];
    let realMinutes = minutes;
    if (pattern[dow] === "R") {
      focus = "恢复日";
      items = pickItems("柔韧恢复", 2, banned);
      realMinutes = Math.min(minutes, 20);
    } else if (banned.length > 0 && WORKOUT_POOL[TRAIN_CATS[dow]].every((it) => banned.some((b) => b.test(it)))) {
      focus = "低冲击训练";
      items = pickItems("上肢与核心", nItems, banned);
    } else {
      focus = TRAIN_CATS[dow];
      items = pickItems(focus, nItems, banned);
      if (week >= 2) realMinutes = round10(minutes * 1.15); // 后两周强度+15%
    }

    const themeWeek = THEME_BY_WEEK[Math.min(week, 3)];
    const theme = `${themeWeek} · ${focus}`;

    const b = meals.breakfast[i % meals.breakfast.length];
    const l = meals.lunch[i % meals.lunch.length];
    const d = meals.dinner[i % meals.dinner.length];
    const s = meals.snack[i % meals.snack.length];

    const dayMeals: PlanMeal[] = [
      { meal: "早餐", desc: b, kcal: round10(calories * split["早餐"]) },
      { meal: "午餐", desc: l, kcal: round10(calories * split["午餐"]) },
      { meal: "晚餐", desc: d, kcal: round10(calories * split["晚餐"]) },
    ];
    if (split["加餐"] > 0) {
      dayMeals.push({ meal: "加餐", desc: s, kcal: round10(calories * split["加餐"] / (twoSnacks ? 2 : 1)) });
      if (twoSnacks) dayMeals.push({ meal: "加餐", desc: "黄瓜条 / 胡萝卜条", kcal: round10(calories * split["加餐"] / 2) });
    }

    days.push({
      day,
      theme,
      workout: { focus, items, minutes: realMinutes },
      meals: dayMeals,
      tip: TIPS[i % TIPS.length],
    });
  }

  return { version: PLAN_VERSION, days };
}
