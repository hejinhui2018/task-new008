import type { RuleEffect } from './types';

const cnyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
});

export function formatCny(value: number): string {
  return cnyFormatter.format(value);
}

/** 带正负号的金额，用于差额展示。 */
export function formatSignedCny(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return sign + cnyFormatter.format(Math.abs(value));
}

export function formatEffect(effect: RuleEffect): string {
  switch (effect.kind) {
    case 'set-base':
      return `基础 ${formatCny(effect.amount)}`;
    case 'multiply':
      return `×${effect.factor}`;
    case 'add':
      return `+${formatCny(effect.amount)}`;
  }
}
