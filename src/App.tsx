import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import ExplanationPanel from './components/ExplanationPanel';
import HistoryPanel from './components/HistoryPanel';
import InputPanel from './components/InputPanel';
import PlanCards from './components/PlanCards';
import { DEFAULT_INPUT, PLANS, RULES } from './domain/data';
import { evaluateAll } from './domain/engine';
import type { CalculatorInput, PlanId } from './domain/types';
import { historyReducer, initHistory, inputsEqual } from './state/history';

export default function App() {
  const [history, dispatch] = useReducer(historyReducer, DEFAULT_INPUT, initHistory);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('standard');

  const input = history.entries[history.index].input;
  const previousInput = history.index > 0 ? history.entries[history.index - 1].input : null;
  const changeLabel = history.index > 0 ? history.entries[history.index].label : null;

  // 任何字段变化都会触发全量重算，解释随结果一起更新。
  const quotes = useMemo(() => evaluateAll(input, PLANS, RULES), [input]);
  const previousQuotes = useMemo(
    () => (previousInput ? evaluateAll(previousInput, PLANS, RULES) : null),
    [previousInput],
  );

  const selectedQuote = quotes.find((quote) => quote.plan.id === selectedPlanId) ?? quotes[0];
  const selectedPrevious =
    previousQuotes?.find((quote) => quote.plan.id === selectedQuote.plan.id) ?? null;

  const changeInput = useCallback((next: CalculatorInput, coalesceKey?: string) => {
    dispatch({ type: 'change', next, coalesceKey });
  }, []);

  const canUndo = history.index > 0;
  const canRedo = history.index < history.entries.length - 1;
  const isDefault = inputsEqual(input, DEFAULT_INPUT);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      // 输入框内保留浏览器原生撤销行为。
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        dispatch({ type: 'undo' });
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        dispatch({ type: 'redo' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>保费方案试算台</h1>
          <p className="subtitle">调整投保条件，实时查看保费由哪些规则叠加而成（数据与规则均为本地内置演示数据）</p>
        </div>
        <div className="toolbar">
          <button type="button" className="btn" disabled={!canUndo} onClick={() => dispatch({ type: 'undo' })}>
            ↩ 撤销
          </button>
          <button type="button" className="btn" disabled={!canRedo} onClick={() => dispatch({ type: 'redo' })}>
            ↪ 重做
          </button>
          <button type="button" className="btn" disabled={isDefault} onClick={() => dispatch({ type: 'reset' })}>
            恢复默认
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="col col-input" aria-label="投保条件">
          <InputPanel input={input} onChange={changeInput} />
        </section>

        <section className="col col-plans" aria-label="方案与保费">
          <h2 className="col-title">方案与保费</h2>
          <PlanCards
            quotes={quotes}
            previousQuotes={previousQuotes}
            selectedPlanId={selectedPlanId}
            onSelect={setSelectedPlanId}
          />
          <HistoryPanel
            history={history}
            selectedPlanId={selectedPlanId}
            onJump={(index) => dispatch({ type: 'jump', index })}
          />
        </section>

        <section className="col col-explain" aria-label="规则解释">
          <ExplanationPanel quote={selectedQuote} previousQuote={selectedPrevious} changeLabel={changeLabel} />
        </section>
      </main>
    </div>
  );
}
