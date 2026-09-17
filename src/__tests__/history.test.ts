import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUT, PLANS } from '../domain/data';
import { evaluatePlan } from '../domain/engine';
import type { CalculatorInput } from '../domain/types';
import { describeChange, historyReducer, initHistory, inputsEqual } from '../state/history';

const basic = PLANS.find((p) => p.id === 'basic')!;
const totalOf = (input: CalculatorInput) => evaluatePlan(input, basic).total;

describe('重算历史（撤销 / 重做）', () => {
  it('初始只有一条默认记录', () => {
    const state = initHistory();
    expect(state.entries).toHaveLength(1);
    expect(state.index).toBe(0);
    expect(inputsEqual(state.entries[0].input, DEFAULT_INPUT)).toBe(true);
  });

  it('每次字段变化都追加一条历史，并生成字段级变更说明', () => {
    let state = initHistory();
    state = historyReducer(state, { type: 'change', next: { ...DEFAULT_INPUT, age: 40 } });
    expect(state.entries).toHaveLength(2);
    expect(state.entries[1].label).toBe('年龄 35 → 40');

    state = historyReducer(state, {
      type: 'change',
      next: { ...DEFAULT_INPUT, age: 40, riders: ['rider-accident-hospital'] },
    });
    expect(state.entries).toHaveLength(3);
    expect(state.entries[2].label).toBe('附加险 +意外住院津贴');
  });

  it('撤销/重做改变当前输入，重新计算结果随之变化', () => {
    let state = initHistory();
    state = historyReducer(state, { type: 'change', next: { ...DEFAULT_INPUT, age: 30 } });
    state = historyReducer(state, { type: 'change', next: { ...DEFAULT_INPUT, age: 31 } });

    // 31 岁：299 ×1.15 ×2.4 = 825.24
    expect(totalOf(state.entries[state.index].input)).toBeCloseTo(825.24, 2);

    state = historyReducer(state, { type: 'undo' });
    expect(state.entries[state.index].input.age).toBe(30);
    // 30 岁：299 ×1.0 ×2.4 = 717.6
    expect(totalOf(state.entries[state.index].input)).toBeCloseTo(717.6, 2);

    state = historyReducer(state, { type: 'undo' });
    expect(state.entries[state.index].input.age).toBe(35);

    state = historyReducer(state, { type: 'redo' });
    expect(state.entries[state.index].input.age).toBe(30);
    state = historyReducer(state, { type: 'redo' });
    expect(state.entries[state.index].input.age).toBe(31);

    // 边界处再次撤销/重做为空操作
    state = historyReducer(state, { type: 'redo' });
    expect(state.entries[state.index].input.age).toBe(31);
  });

  it('撤销后产生新修改会截断重做分支', () => {
    let state = initHistory();
    state = historyReducer(state, { type: 'change', next: { ...DEFAULT_INPUT, age: 40 } });
    state = historyReducer(state, { type: 'change', next: { ...DEFAULT_INPUT, age: 50 } });
    state = historyReducer(state, { type: 'undo' });
    state = historyReducer(state, { type: 'change', next: { ...DEFAULT_INPUT, age: 28 } });

    expect(state.entries).toHaveLength(3);
    expect(state.entries.map((e) => e.input.age)).toEqual([35, 40, 28]);

    state = historyReducer(state, { type: 'redo' });
    expect(state.entries[state.index].input.age).toBe(28);
  });

  it('条件未实际变化时不产生新记录', () => {
    let state = initHistory();
    state = historyReducer(state, { type: 'change', next: { ...DEFAULT_INPUT } });
    expect(state.entries).toHaveLength(1);
    state = historyReducer(state, { type: 'reset' });
    expect(state.entries).toHaveLength(1);
  });

  it('恢复默认追加一条记录而非清空历史，可撤销回自定义状态', () => {
    let state = initHistory();
    state = historyReducer(state, { type: 'change', next: { ...DEFAULT_INPUT, age: 60 } });
    state = historyReducer(state, { type: 'reset' });

    expect(state.entries).toHaveLength(3);
    expect(state.entries[2].label).toBe('恢复默认条件');
    expect(inputsEqual(state.entries[2].input, DEFAULT_INPUT)).toBe(true);

    state = historyReducer(state, { type: 'undo' });
    expect(state.entries[state.index].input.age).toBe(60);
  });

  it('同一字段的连续输入合并为一条历史（coalesce）', () => {
    let state = initHistory();
    state = historyReducer(state, { type: 'change', next: { ...DEFAULT_INPUT, age: 4 }, coalesceKey: 'age' });
    state = historyReducer(state, { type: 'change', next: { ...DEFAULT_INPUT, age: 45 }, coalesceKey: 'age' });

    expect(state.entries).toHaveLength(2);
    expect(state.entries[1].input.age).toBe(45);
    expect(state.entries[1].label).toBe('年龄 35 → 45');

    state = historyReducer(state, { type: 'undo' });
    expect(state.entries[state.index].input.age).toBe(35);
  });

  it('jump 可跳到历史中的任意位置，越界时收敛到端点', () => {
    let state = initHistory();
    state = historyReducer(state, { type: 'change', next: { ...DEFAULT_INPUT, age: 40 } });
    state = historyReducer(state, { type: 'change', next: { ...DEFAULT_INPUT, age: 50 } });

    state = historyReducer(state, { type: 'jump', index: 0 });
    expect(state.entries[state.index].input.age).toBe(35);

    state = historyReducer(state, { type: 'jump', index: 99 });
    expect(state.entries[state.index].input.age).toBe(50);
  });
});

describe('describeChange', () => {
  it('描述地区与保额变化', () => {
    const label = describeChange(DEFAULT_INPUT, { ...DEFAULT_INPUT, region: 'tier1', coverage: 'c100' });
    expect(label).toBe('地区 二线城市 → 一线城市；保额 30 万 → 100 万');
  });

  it('描述附加险勾选与取消', () => {
    const label = describeChange(
      { ...DEFAULT_INPUT, riders: ['rider-accident-medical'] },
      { ...DEFAULT_INPUT, riders: ['rider-traffic-double'] },
    );
    expect(label).toBe('附加险 +交通意外加倍赔；附加险 −意外医疗附加险');
  });

  it('清空字段时显示「未填」', () => {
    const label = describeChange(DEFAULT_INPUT, { ...DEFAULT_INPUT, age: null });
    expect(label).toBe('年龄 35 → 未填');
  });
});
