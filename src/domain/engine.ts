import { FIELD_LABELS, MAX_AGE, MIN_AGE, PLANS, RULES } from './data';
import type {
  AppliedStep,
  CalculatorInput,
  InputField,
  Plan,
  PlanQuote,
  QuoteStatus,
  Rule,
  RuleEffect,
  SkippedRule,
  SuppressedRule,
} from './types';

export const REQUIRED_FIELDS: InputField[] = ['age', 'region', 'coverage'];

export interface InputProblem {
  missing: InputField[];
  invalid: string[];
}

/** 校验输入：返回缺失的必填字段与非法值说明。 */
export function validateInput(input: CalculatorInput): InputProblem {
  const missing: InputField[] = [];
  if (input.age === null) missing.push('age');
  if (input.region === null) missing.push('region');
  if (input.coverage === null) missing.push('coverage');

  const invalid: string[] = [];
  if (input.age !== null && (!Number.isFinite(input.age) || input.age < MIN_AGE || input.age > MAX_AGE)) {
    invalid.push(`投保年龄需在 ${MIN_AGE}–${MAX_AGE} 周岁之间（当前：${input.age} 岁）`);
  }
  return { missing, invalid };
}

function applyEffect(current: number, effect: RuleEffect): number {
  switch (effect.kind) {
    case 'set-base':
      return effect.amount;
    case 'multiply':
      return current * effect.factor;
    case 'add':
      return current + effect.amount;
  }
}

function byPriorityAsc(a: Rule, b: Rule): number {
  return a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function planScopeText(rule: Rule): string {
  if (!rule.planIds) return '全部方案';
  return rule.planIds.map((id) => PLANS.find((p) => p.id === id)?.name ?? id).join('、');
}

/**
 * 对单个方案执行完整试算：
 * 1. 校验输入（缺失 / 非法）；
 * 2. 过滤适用范围，跳过被缺失输入阻断的规则；
 * 3. 求出命中规则，按优先级解决互斥；
 * 4. 按优先级升序依次应用，记录每一步的调整前/调整后金额。
 */
export function evaluatePlan(input: CalculatorInput, plan: Plan, rules: Rule[] = RULES): PlanQuote {
  const { missing, invalid } = validateInput(input);
  const status: QuoteStatus = invalid.length > 0 ? 'invalid' : missing.length > 0 ? 'incomplete' : 'ok';
  const ctx = { input, plan };

  const steps: AppliedStep[] = [];
  const suppressed: SuppressedRule[] = [];
  const skipped: SkippedRule[] = [];

  const inScope = rules.filter((rule) => !rule.planIds || rule.planIds.includes(plan.id));
  for (const rule of rules) {
    if (rule.planIds && !rule.planIds.includes(plan.id)) {
      skipped.push({
        ruleId: rule.id,
        ruleName: rule.name,
        reason: 'out-of-scope',
        detail: `仅适用于：${planScopeText(rule)}`,
      });
    }
  }

  let running = 0;

  // 输入非法（如年龄超出可保范围）时不做任何计算。
  if (status !== 'invalid') {
    const evaluable: Rule[] = [];
    for (const rule of inScope) {
      const blockedBy = (rule.requires ?? []).filter((field) => missing.includes(field));
      if (blockedBy.length > 0) {
        skipped.push({
          ruleId: rule.id,
          ruleName: rule.name,
          reason: 'missing-input',
          detail: `缺少${blockedBy.map((field) => FIELD_LABELS[field]).join('、')}，暂无法判断`,
        });
      } else {
        evaluable.push(rule);
      }
    }

    const hit: Rule[] = [];
    for (const rule of evaluable) {
      if (rule.when(ctx)) {
        hit.push(rule);
      } else {
        skipped.push({
          ruleId: rule.id,
          ruleName: rule.name,
          reason: 'condition-not-met',
          detail: '触发条件未满足',
        });
      }
    }

    // 互斥处理：优先级高者胜出；优先级相同按规则编号字典序，保证结果确定。
    const hitById = new Map(hit.map((rule) => [rule.id, rule] as const));
    const suppressedIds = new Set<string>();
    const hitOrdered = [...hit].sort((a, b) => byPriorityAsc(b, a));
    for (const rule of hitOrdered) {
      if (suppressedIds.has(rule.id)) continue;
      for (const otherId of rule.conflictsWith ?? []) {
        const other = hitById.get(otherId);
        if (!other || suppressedIds.has(other.id)) continue;
        const winner =
          rule.priority > other.priority
            ? rule
            : rule.priority < other.priority
              ? other
              : rule.id <= other.id
                ? rule
                : other;
        const loser = winner === rule ? other : rule;
        suppressedIds.add(loser.id);
        suppressed.push({
          ruleId: loser.id,
          ruleName: loser.name,
          priority: loser.priority,
          suppressedBy: winner.id,
          suppressedByName: winner.name,
          reason:
            loser.priority === winner.priority
              ? `与「${winner.name}」互斥且优先级相同（${winner.priority}），按规则编号顺序保留「${winner.name}」`
              : `与「${winner.name}」互斥，优先级 ${loser.priority} 低于对方 ${winner.priority}，未生效`,
        });
      }
    }

    const effective = hit.filter((rule) => !suppressedIds.has(rule.id)).sort(byPriorityAsc);
    for (const rule of effective) {
      const effect = rule.effect(ctx);
      const before = running;
      running = applyEffect(running, effect);
      steps.push({
        ruleId: rule.id,
        ruleName: rule.name,
        category: rule.category,
        priority: rule.priority,
        effect,
        before,
        after: running,
        note: rule.note?.(ctx) ?? rule.description,
      });
    }
  }

  return {
    plan,
    status,
    missingFields: missing,
    invalidReasons: invalid,
    steps,
    suppressed,
    skipped,
    total: status === 'ok' ? running : null,
  };
}

export function evaluateAll(input: CalculatorInput, plans: Plan[] = PLANS, rules: Rule[] = RULES): PlanQuote[] {
  return plans.map((plan) => evaluatePlan(input, plan, rules));
}
