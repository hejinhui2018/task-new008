/** 投保条件：顾问在左侧面板录入的全部字段。null 表示尚未填写。 */
export interface CalculatorInput {
  age: number | null;
  region: RegionCode | null;
  coverage: CoverageCode | null;
  riders: RiderId[];
}

export type RegionCode = 'tier1' | 'tier2' | 'tier3';
export type CoverageCode = 'c10' | 'c30' | 'c50' | 'c100';
export type RiderId =
  | 'rider-accident-medical'
  | 'rider-accident-hospital'
  | 'rider-traffic-double'
  | 'rider-full-accident';

export type PlanId = 'basic' | 'standard' | 'premium';

/** 报价所必需的输入字段（附加险不选也是合法状态，不在其列）。 */
export type InputField = 'age' | 'region' | 'coverage';

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  basePremium: number;
}

export type RuleCategory = 'base' | 'age' | 'coverage' | 'region' | 'rider' | 'discount';

export type RuleEffect =
  | { kind: 'set-base'; amount: number }
  | { kind: 'multiply'; factor: number }
  | { kind: 'add'; amount: number };

export interface RuleContext {
  input: CalculatorInput;
  plan: Plan;
}

/**
 * 定价规则。
 * - priority：数值越小越先参与计算；互斥冲突时数值大者胜出（相同则按规则编号字典序）。
 * - planIds：适用范围，缺省表示全部方案。
 * - requires：规则求值前必须已填写的输入字段。
 * - conflictsWith：互斥规则 id 列表。
 */
export interface Rule {
  id: string;
  name: string;
  category: RuleCategory;
  description: string;
  priority: number;
  planIds?: PlanId[];
  requires?: InputField[];
  conflictsWith?: string[];
  when: (ctx: RuleContext) => boolean;
  effect: (ctx: RuleContext) => RuleEffect;
  note?: (ctx: RuleContext) => string;
}

/** 一条已应用的计算步骤（调整前 → 调整后）。 */
export interface AppliedStep {
  ruleId: string;
  ruleName: string;
  category: RuleCategory;
  priority: number;
  effect: RuleEffect;
  before: number;
  after: number;
  note: string;
}

/** 命中但因互斥被压制的规则。 */
export interface SuppressedRule {
  ruleId: string;
  ruleName: string;
  priority: number;
  suppressedBy: string;
  suppressedByName: string;
  reason: string;
}

export type SkipReason = 'out-of-scope' | 'condition-not-met' | 'missing-input';

/** 未参与计算的规则及原因。 */
export interface SkippedRule {
  ruleId: string;
  ruleName: string;
  reason: SkipReason;
  detail: string;
}

export type QuoteStatus = 'ok' | 'incomplete' | 'invalid';

/** 单个方案的完整试算结果。 */
export interface PlanQuote {
  plan: Plan;
  status: QuoteStatus;
  missingFields: InputField[];
  invalidReasons: string[];
  steps: AppliedStep[];
  suppressed: SuppressedRule[];
  skipped: SkippedRule[];
  /** 年缴保费合计；输入不完整或非法时为 null。 */
  total: number | null;
}
