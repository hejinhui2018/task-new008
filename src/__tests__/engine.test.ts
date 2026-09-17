import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUT, PLANS } from '../domain/data';
import { evaluateAll, evaluatePlan, validateInput } from '../domain/engine';
import type { CalculatorInput, Rule } from '../domain/types';

const basic = PLANS.find((p) => p.id === 'basic')!;
const standard = PLANS.find((p) => p.id === 'standard')!;
const premium = PLANS.find((p) => p.id === 'premium')!;

function inputWith(patch: Partial<CalculatorInput>): CalculatorInput {
  return { ...DEFAULT_INPUT, ...patch };
}

describe('规则优先级与应用顺序', () => {
  it('按优先级升序应用，折扣在附加险之后作用于整单', () => {
    const quote = evaluatePlan(
      inputWith({ age: 25, region: 'tier2', coverage: 'c50', riders: ['rider-accident-hospital'] }),
      basic,
    );
    expect(quote.status).toBe('ok');

    // 299 ×1.0(年龄) ×3.8(保额) ×1.0(地区) +90(津贴) = 1226.2，再 ×0.95 = 1164.89
    expect(quote.total).toBeCloseTo(1164.89, 2);

    const priorities = quote.steps.map((s) => s.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));

    const riderStep = quote.steps.find((s) => s.ruleId === 'rider-accident-hospital')!;
    expect(riderStep.after).toBeCloseTo(1226.2, 2);
    expect(quote.steps[quote.steps.length - 1].ruleId).toBe('discount-high-coverage');
  });

  it('应用顺序由优先级决定，而非规则类型或定义顺序', () => {
    const customRules: Rule[] = [
      {
        id: 'r-add',
        name: '后加 100',
        category: 'rider',
        description: '',
        priority: 5,
        when: () => true,
        effect: () => ({ kind: 'add', amount: 100 }),
      },
      {
        id: 'r-mul',
        name: '先乘 2',
        category: 'age',
        description: '',
        priority: 3,
        when: () => true,
        effect: () => ({ kind: 'multiply', factor: 2 }),
      },
      {
        id: 'r-base',
        name: '基础 10',
        category: 'base',
        description: '',
        priority: 0,
        when: () => true,
        effect: () => ({ kind: 'set-base', amount: 10 }),
      },
    ];
    const quote = evaluatePlan(DEFAULT_INPUT, basic, customRules);
    // (10 × 2) + 100 = 120，而不是 (10 + 100) × 2 = 220
    expect(quote.total).toBeCloseTo(120, 6);
    expect(quote.steps.map((s) => s.ruleId)).toEqual(['r-base', 'r-mul', 'r-add']);
  });

  it('evaluateAll 对全部方案分别试算', () => {
    const quotes = evaluateAll(DEFAULT_INPUT);
    expect(quotes).toHaveLength(3);
    // 默认条件：35 岁 ×1.15，二线城市 ×1.0，30 万 ×2.4
    expect(quotes.find((q) => q.plan.id === 'basic')!.total).toBeCloseTo(825.24, 2);
    expect(quotes.find((q) => q.plan.id === 'standard')!.total).toBeCloseTo(1460.04, 2);
    expect(quotes.find((q) => q.plan.id === 'premium')!.total).toBeCloseTo(2481.24, 2);
  });
});

describe('互斥规则', () => {
  it('综合意外升级包与交通意外加倍互斥，优先级高者生效', () => {
    const quote = evaluatePlan(
      inputWith({ age: 40, region: 'tier2', coverage: 'c10', riders: ['rider-full-accident', 'rider-traffic-double'] }),
      standard,
    );
    // 529 ×1.15 + 260 = 868.35；交通加倍（+110）被压制
    expect(quote.total).toBeCloseTo(868.35, 2);
    expect(quote.suppressed).toHaveLength(1);
    expect(quote.suppressed[0].ruleId).toBe('rider-traffic-double');
    expect(quote.suppressed[0].suppressedBy).toBe('rider-full-accident');
    expect(quote.suppressed[0].reason).toContain('互斥');
    expect(quote.steps.some((s) => s.ruleId === 'rider-traffic-double')).toBe(false);
    expect(quote.steps.some((s) => s.ruleId === 'rider-full-accident')).toBe(true);
  });

  it('升级包可同时压制意外医疗与交通加倍两条规则', () => {
    const quote = evaluatePlan(
      inputWith({
        age: 40,
        region: 'tier2',
        coverage: 'c10',
        riders: ['rider-full-accident', 'rider-traffic-double', 'rider-accident-medical'],
      }),
      standard,
    );
    expect(quote.suppressed.map((s) => s.ruleId).sort()).toEqual([
      'rider-accident-medical',
      'rider-traffic-double',
    ]);
    expect(quote.total).toBeCloseTo(868.35, 2);
  });

  it('基础版不适用升级包（适用范围），交通加倍正常生效、无互斥', () => {
    const quote = evaluatePlan(
      inputWith({ age: 40, region: 'tier2', coverage: 'c10', riders: ['rider-full-accident', 'rider-traffic-double'] }),
      basic,
    );
    expect(quote.suppressed).toHaveLength(0);
    const skipped = quote.skipped.find((s) => s.ruleId === 'rider-full-accident');
    expect(skipped?.reason).toBe('out-of-scope');
    // 299 ×1.15 + 110 = 453.85
    expect(quote.total).toBeCloseTo(453.85, 2);
  });

  it('优先级相同的互斥规则按规则编号确定胜负，结果可复现', () => {
    const makeRule = (id: string, other: string, amount: number): Rule => ({
      id,
      name: id,
      category: 'rider',
      description: '',
      priority: 40,
      conflictsWith: [other],
      when: () => true,
      effect: () => ({ kind: 'add', amount }),
    });
    const customRules: Rule[] = [
      {
        id: 'r-base',
        name: '基础',
        category: 'base',
        description: '',
        priority: 0,
        when: () => true,
        effect: () => ({ kind: 'set-base', amount: 100 }),
      },
      makeRule('rule-b', 'rule-a', 2),
      makeRule('rule-a', 'rule-b', 1),
    ];
    const quote = evaluatePlan(DEFAULT_INPUT, basic, customRules);
    expect(quote.suppressed).toHaveLength(1);
    expect(quote.suppressed[0].ruleId).toBe('rule-b');
    expect(quote.suppressed[0].reason).toContain('优先级相同');
    expect(quote.total).toBeCloseTo(101, 6);
  });
});

describe('边界年龄', () => {
  const cases: [number, string, number][] = [
    [18, 'age-18-30', 299],
    [30, 'age-18-30', 299],
    [31, 'age-31-40', 343.85],
    [40, 'age-31-40', 343.85],
    [41, 'age-41-50', 403.65],
    [50, 'age-41-50', 403.65],
    [51, 'age-51-60', 478.4],
    [60, 'age-51-60', 478.4],
    [61, 'age-61-75', 598],
    [75, 'age-61-75', 598],
  ];

  it.each(cases)('年龄 %i 命中规则 %s（基础版/10 万/二线城市）', (age, ruleId, expected) => {
    const quote = evaluatePlan(inputWith({ age, region: 'tier2', coverage: 'c10', riders: [] }), basic);
    expect(quote.status).toBe('ok');
    const ageStep = quote.steps.find((s) => s.category === 'age')!;
    expect(ageStep.ruleId).toBe(ruleId);
    expect(quote.total).toBeCloseTo(expected, 2);
  });

  it.each([17, 76, 0, -3])('年龄 %i 超出可保范围，状态为 invalid 且不计算', (age) => {
    const quote = evaluatePlan(inputWith({ age }), basic);
    expect(quote.status).toBe('invalid');
    expect(quote.total).toBeNull();
    expect(quote.invalidReasons.length).toBeGreaterThan(0);
    expect(quote.steps).toHaveLength(0);
  });
});

describe('缺失输入', () => {
  it('全部必填缺失：状态 incomplete，仅基础保费可计算', () => {
    const quote = evaluatePlan({ age: null, region: null, coverage: null, riders: [] }, basic);
    expect(quote.status).toBe('incomplete');
    expect(quote.missingFields).toEqual(['age', 'region', 'coverage']);
    expect(quote.total).toBeNull();
    expect(quote.steps.map((s) => s.ruleId)).toEqual(['base-premium']);
    expect(quote.skipped.find((s) => s.ruleId === 'age-18-30')?.reason).toBe('missing-input');
    expect(quote.skipped.find((s) => s.ruleId === 'region-tier2')?.reason).toBe('missing-input');
    expect(quote.skipped.find((s) => s.ruleId === 'coverage-c30')?.reason).toBe('missing-input');
    expect(quote.skipped.find((s) => s.ruleId === 'discount-high-coverage')?.reason).toBe('missing-input');
  });

  it('部分缺失：已满足的规则照常计算，缺失项明确标注', () => {
    const quote = evaluatePlan(
      { age: 30, region: null, coverage: null, riders: ['rider-accident-hospital'] },
      basic,
    );
    expect(quote.status).toBe('incomplete');
    expect(quote.missingFields).toEqual(['region', 'coverage']);
    const stepIds = quote.steps.map((s) => s.ruleId);
    expect(stepIds).toContain('base-premium');
    expect(stepIds).toContain('age-18-30');
    expect(stepIds).toContain('rider-accident-hospital');
    expect(quote.skipped.find((s) => s.ruleId === 'region-tier1')?.reason).toBe('missing-input');
    expect(quote.total).toBeNull();
  });

  it('validateInput 同时报告缺失与非法', () => {
    expect(validateInput({ age: null, region: null, coverage: null, riders: [] }).missing).toHaveLength(3);
    const problem = validateInput(inputWith({ age: 200 }));
    expect(problem.missing).toHaveLength(0);
    expect(problem.invalid).toHaveLength(1);
  });
});

describe('适用范围', () => {
  it('高保额优惠不适用于尊享旗舰版', () => {
    const quote = evaluatePlan(inputWith({ coverage: 'c50' }), premium);
    expect(quote.skipped.find((s) => s.ruleId === 'discount-high-coverage')?.reason).toBe('out-of-scope');
    // 899 ×1.15 ×3.8 = 3928.63，无 95 折
    expect(quote.total).toBeCloseTo(3928.63, 2);
  });

  it('高保额优惠适用于标准版并作用于整单', () => {
    const quote = evaluatePlan(inputWith({ coverage: 'c50' }), standard);
    // 529 ×1.15 ×3.8 ×0.95 = 2196.1435
    expect(quote.total).toBeCloseTo(2196.14, 2);
    expect(quote.steps.some((s) => s.ruleId === 'discount-high-coverage')).toBe(true);
  });
});
