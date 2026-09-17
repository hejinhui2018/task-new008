import { useMemo } from 'react';
import { planById } from '../domain/data';
import { evaluatePlan } from '../domain/engine';
import { formatCny } from '../domain/format';
import type { PlanId } from '../domain/types';
import type { HistoryState } from '../state/history';

interface HistoryPanelProps {
  history: HistoryState;
  selectedPlanId: PlanId;
  onJump: (index: number) => void;
}

/** 重算历史：每次条件变更一条记录，点击可回到对应状态。 */
export default function HistoryPanel({ history, selectedPlanId, onJump }: HistoryPanelProps) {
  const plan = planById(selectedPlanId);
  const rows = useMemo(
    () =>
      history.entries.map((entry, index) => ({
        entry,
        index,
        total: evaluatePlan(entry.input, plan).total,
      })),
    [history.entries, plan],
  );

  return (
    <div className="panel history-panel">
      <h2>重算历史</h2>
      <ol className="history-list">
        {rows.map(({ entry, index, total }) => {
          const isCurrent = index === history.index;
          const isFuture = index > history.index;
          return (
            <li key={index}>
              <button
                type="button"
                className={`history-item${isCurrent ? ' current' : ''}${isFuture ? ' future' : ''}`}
                onClick={() => onJump(index)}
              >
                <span className="history-seq">#{index + 1}</span>
                <span className="history-label">{entry.label}</span>
                <span className="history-total">
                  {total !== null ? `${formatCny(total)}/年` : '—'}
                  {isCurrent && <em>（当前）</em>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
