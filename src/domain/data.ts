import type {
  CalculatorInput,
  CoverageCode,
  InputField,
  Plan,
  PlanId,
  RegionCode,
  RiderId,
  Rule,
  RuleCategory,
} from './types';

export const MIN_AGE = 18;
export const MAX_AGE = 75;

// ---------------------------------------------------------------------------
// 方案（产品）
// ---------------------------------------------------------------------------

export const PLANS: Plan[] = [
  { id: 'basic', name: '安心基础版', tagline: '核心意外保障，入门首选', basePremium: 299 },
  { id: 'standard', name: '守护标准版', tagline: '意外与医疗均衡配置', basePremium: 529 },
  { id: 'premium', name: '尊享旗舰版', tagline: '高额度全面守护', basePremium: 899 },
];

// ---------------------------------------------------------------------------
// 费率表（演示用内置数据，全部在浏览器本地）
// ---------------------------------------------------------------------------

/** 年龄区间费率：边界值落在较低区间（如 30 岁仍属 18–30 档）。 */
export const AGE_BANDS = [
  { min: 18, max: 30, factor: 1.0 },
  { min: 31, max: 40, factor: 1.15 },
  { min: 41, max: 50, factor: 1.35 },
  { min: 51, max: 60, factor: 1.6 },
  { min: 61, max: 75, factor: 2.0 },
] as const;

export const COVERAGE_TIERS: { code: CoverageCode; label: string; factor: number }[] = [
  { code: 'c10', label: '10 万', factor: 1.0 },
  { code: 'c30', label: '30 万', factor: 2.4 },
  { code: 'c50', label: '50 万', factor: 3.8 },
  { code: 'c100', label: '100 万', factor: 7.0 },
];

export const REGIONS: { code: RegionCode; label: string; shortLabel: string; factor: number }[] = [
  { code: 'tier1', label: '一线城市（北京 / 上海 / 广州 / 深圳）', shortLabel: '一线城市', factor: 1.15 },
  { code: 'tier2', label: '二线城市', shortLabel: '二线城市', factor: 1.0 },
  { code: 'tier3', label: '三线及以下城市', shortLabel: '三线及以下', factor: 0.92 },
];

export const RIDERS: { id: RiderId; name: string; price: number; desc: string }[] = [
  { id: 'rider-accident-medical', name: '意外医疗附加险', price: 120, desc: '报销意外门急诊及住院医疗费用。' },
  { id: 'rider-accident-hospital', name: '意外住院津贴', price: 90, desc: '意外住院期间每日给付 100 元津贴。' },
  { id: 'rider-traffic-double', name: '交通意外加倍赔', price: 110, desc: '公共交通意外身故/伤残保额翻倍。' },
  { id: 'rider-full-accident', name: '综合意外升级包', price: 260, desc: '打包升级，已包含交通加倍与意外医疗的核心责任。' },
];

export const DEFAULT_INPUT: CalculatorInput = {
  age: 35,
  region: 'tier2',
  coverage: 'c30',
  riders: [],
};

// ---------------------------------------------------------------------------
// 展示用标签
// ---------------------------------------------------------------------------

export const FIELD_LABELS: Record<InputField, string> = {
  age: '年龄',
  region: '投保地区',
  coverage: '保障额度',
};

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  base: '基础保费',
  age: '年龄费率',
  coverage: '保额档位',
  region: '地区系数',
  rider: '附加险',
  discount: '优惠折扣',
};

export function planById(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`未知方案：${id}`);
  return plan;
}

export function regionLabel(code: RegionCode | null): string {
  return REGIONS.find((r) => r.code === code)?.shortLabel ?? '未选择';
}

export function coverageLabel(code: CoverageCode | null): string {
  return COVERAGE_TIERS.find((t) => t.code === code)?.label ?? '未选择';
}

export function riderLabel(id: RiderId): string {
  return RIDERS.find((r) => r.id === id)?.name ?? id;
}

// ---------------------------------------------------------------------------
// 规则定义：由费率表生成，保证数据与规则一致
// ---------------------------------------------------------------------------

const baseRule: Rule = {
  id: 'base-premium',
  name: '基础保费',
  category: 'base',
  description: '每个方案都有一档年缴基础保费，是保费计算的起点。',
  priority: 0,
  when: () => true,
  effect: (ctx) => ({ kind: 'set-base', amount: ctx.plan.basePremium }),
  note: (ctx) => `${ctx.plan.name}基础保费 ¥${ctx.plan.basePremium}/年`,
};

const ageRules: Rule[] = AGE_BANDS.map((band) => ({
  id: `age-${band.min}-${band.max}`,
  name: `年龄费率（${band.min}–${band.max} 岁）`,
  category: 'age',
  description: `被保人年龄处于 ${band.min}–${band.max} 周岁区间时，保费按 ×${band.factor} 调整。`,
  priority: 10,
  requires: ['age'],
  when: (ctx) => ctx.input.age !== null && ctx.input.age >= band.min && ctx.input.age <= band.max,
  effect: () => ({ kind: 'multiply', factor: band.factor }),
  note: (ctx) => `${ctx.input.age} 岁落在 ${band.min}–${band.max} 岁档，费率 ×${band.factor}`,
}));

const coverageRules: Rule[] = COVERAGE_TIERS.map((tier) => ({
  id: `coverage-${tier.code}`,
  name: `保额档位（${tier.label}）`,
  category: 'coverage',
  description: `保障额度选择 ${tier.label} 时，档位系数为 ×${tier.factor}（随保额递增但非线性）。`,
  priority: 20,
  requires: ['coverage'],
  when: (ctx) => ctx.input.coverage === tier.code,
  effect: () => ({ kind: 'multiply', factor: tier.factor }),
  note: () => `保额 ${tier.label} 档，档位系数 ×${tier.factor}`,
}));

const regionRules: Rule[] = REGIONS.map((region) => ({
  id: `region-${region.code}`,
  name: `地区系数（${region.shortLabel}）`,
  category: 'region',
  description: `投保地区为${region.shortLabel}时，地区系数为 ×${region.factor}。`,
  priority: 30,
  requires: ['region'],
  when: (ctx) => ctx.input.region === region.code,
  effect: () => ({ kind: 'multiply', factor: region.factor }),
  note: () => `${region.shortLabel}，地区系数 ×${region.factor}`,
}));

/** 附加险的优先级 / 适用范围 / 互斥关系配置。 */
const RIDER_RULE_CONFIG: Record<RiderId, { priority: number; planIds?: PlanId[]; conflictsWith?: RiderId[] }> = {
  'rider-accident-medical': { priority: 40, conflictsWith: ['rider-full-accident'] },
  'rider-accident-hospital': { priority: 40 },
  'rider-traffic-double': { priority: 40, conflictsWith: ['rider-full-accident'] },
  // 升级包已含交通加倍与意外医疗责任，故与二者互斥；且仅中高档方案可附加。
  'rider-full-accident': {
    priority: 45,
    planIds: ['standard', 'premium'],
    conflictsWith: ['rider-accident-medical', 'rider-traffic-double'],
  },
};

const riderRules: Rule[] = RIDERS.map((rider) => {
  const config = RIDER_RULE_CONFIG[rider.id];
  return {
    id: rider.id,
    name: rider.name,
    category: 'rider',
    description: rider.desc,
    priority: config.priority,
    planIds: config.planIds,
    conflictsWith: config.conflictsWith,
    when: (ctx) => ctx.input.riders.includes(rider.id),
    effect: () => ({ kind: 'add', amount: rider.price }),
    note: () => `已附加「${rider.name}」，年费 +¥${rider.price}`,
  };
});

const highCoverageDiscount: Rule = {
  id: 'discount-high-coverage',
  name: '高保额优惠（整单 95 折）',
  category: 'discount',
  description:
    '保障额度达到 50 万及以上时，整单保费（含附加险）享 95 折。尊享旗舰版已含最优费率，不参与本优惠。',
  priority: 50,
  planIds: ['basic', 'standard'],
  requires: ['coverage'],
  when: (ctx) => ctx.input.coverage === 'c50' || ctx.input.coverage === 'c100',
  effect: () => ({ kind: 'multiply', factor: 0.95 }),
  note: () => '保额 ≥ 50 万，整单（含附加险）95 折',
};

export const RULES: Rule[] = [
  baseRule,
  ...ageRules,
  ...coverageRules,
  ...regionRules,
  ...riderRules,
  highCoverageDiscount,
];

export function findRule(ruleId: string): Rule | undefined {
  return RULES.find((r) => r.id === ruleId);
}
