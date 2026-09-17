import { coverageLabel, DEFAULT_INPUT, regionLabel, riderLabel } from '../domain/data';
import type { CalculatorInput } from '../domain/types';

/** 一条重算历史：当时的投保条件 + 本次变更的可读说明。 */
export interface HistoryEntry {
  input: CalculatorInput;
  label: string;
  /** 同一字段连续微调（如逐字输入年龄）时用于合并历史，避免刷屏。 */
  coalesceKey?: string;
}

export interface HistoryState {
  entries: HistoryEntry[];
  /** 当前所在位置；index 之后的是可重做的记录。 */
  index: number;
}

export type HistoryAction =
  | { type: 'change'; next: CalculatorInput; coalesceKey?: string }
  | { type: 'reset' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'jump'; index: number };

export function inputsEqual(a: CalculatorInput, b: CalculatorInput): boolean {
  return (
    a.age === b.age &&
    a.region === b.region &&
    a.coverage === b.coverage &&
    a.riders.length === b.riders.length &&
    a.riders.every((rider) => b.riders.includes(rider))
  );
}

/** 生成「调整前 → 调整后」的字段级变更说明。 */
export function describeChange(prev: CalculatorInput, next: CalculatorInput): string {
  const parts: string[] = [];
  if (prev.age !== next.age) {
    parts.push(`年龄 ${prev.age ?? '未填'} → ${next.age ?? '未填'}`);
  }
  if (prev.region !== next.region) {
    parts.push(`地区 ${regionLabel(prev.region)} → ${regionLabel(next.region)}`);
  }
  if (prev.coverage !== next.coverage) {
    parts.push(`保额 ${coverageLabel(prev.coverage)} → ${coverageLabel(next.coverage)}`);
  }
  const added = next.riders.filter((rider) => !prev.riders.includes(rider));
  const removed = prev.riders.filter((rider) => !next.riders.includes(rider));
  if (added.length > 0) parts.push(`附加险 +${added.map(riderLabel).join('、')}`);
  if (removed.length > 0) parts.push(`附加险 −${removed.map(riderLabel).join('、')}`);
  return parts.length > 0 ? parts.join('；') : '条件未变化';
}

export function initHistory(initial: CalculatorInput = DEFAULT_INPUT): HistoryState {
  return { entries: [{ input: initial, label: '初始默认条件' }], index: 0 };
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'change': {
      const current = state.entries[state.index];
      if (inputsEqual(current.input, action.next)) return state;

      // 同一字段的连续微调：替换当前记录而非追加，撤销时一次回到微调前。
      if (
        action.coalesceKey &&
        state.index > 0 &&
        state.index === state.entries.length - 1 &&
        current.coalesceKey === action.coalesceKey
      ) {
        const entries = state.entries.slice();
        entries[state.index] = {
          input: action.next,
          label: describeChange(state.entries[state.index - 1].input, action.next),
          coalesceKey: action.coalesceKey,
        };
        return { entries, index: state.index };
      }

      const entry: HistoryEntry = {
        input: action.next,
        label: describeChange(current.input, action.next),
        coalesceKey: action.coalesceKey,
      };
      const entries = [...state.entries.slice(0, state.index + 1), entry];
      return { entries, index: entries.length - 1 };
    }
    case 'reset': {
      const current = state.entries[state.index];
      if (inputsEqual(current.input, DEFAULT_INPUT)) return state;
      const entries = [
        ...state.entries.slice(0, state.index + 1),
        { input: DEFAULT_INPUT, label: '恢复默认条件' },
      ];
      return { entries, index: entries.length - 1 };
    }
    case 'undo': {
      return state.index <= 0 ? state : { ...state, index: state.index - 1 };
    }
    case 'redo': {
      return state.index >= state.entries.length - 1 ? state : { ...state, index: state.index + 1 };
    }
    case 'jump': {
      const index = Math.max(0, Math.min(action.index, state.entries.length - 1));
      return index === state.index ? state : { ...state, index };
    }
  }
}
