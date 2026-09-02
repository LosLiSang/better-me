/**
 * 题库类型定义 —— 原创中文 33 题健康测评问卷（v1）
 *
 * 题库数据见 `config.ts`；结构测试见 `config.test.ts`。
 * 这里的 key 是 stepKey 单源，POST /step 校验用同一份。
 */

/** 题目变体类型 */
export type QuestionType = "single" | "multi" | "number" | "likert";

/** 选项：单选/多选/量表共用 */
export interface QuizOption {
  value: string;
  label: string;
  /** 选中后立即展示的针对性反馈文案（必须有值，测试兜底"忘配文案"） */
  feedback: string;
  /** 多选题里标记"以上皆非"选项（与其它选项互斥，仅一个） */
  exclusive?: boolean;
}

/** 数字题校验规则 */
export interface NumericValidation {
  min: number;
  max: number;
  /** 单位文本，如 cm / kg */
  unit: string;
}

/** 一条题目 */
export interface QuizQuestion {
  /** 唯一 stepKey（契约单源，跨前后端 + 测试共用） */
  key: string;
  type: QuestionType;
  /** 题目文案 */
  question: string;
  /** 是否必填（计算题必填；反馈题可选） */
  required: boolean;
  /** 是否参与健康评估计算 */
  forCalculation: boolean;
  /** 选项（single/multi/likert 用） */
  options?: QuizOption[];
  /** number 类型用 */
  numeric?: NumericValidation;
}
