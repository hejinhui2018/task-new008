import { FIELD_LABELS } from '../domain/data';
import { formatCny, formatSignedCny } from '../domain/format';
import type { PlanId, PlanQuote } from '../domain/types';

interface PlanCardsProps {
  quotes: PlanQuote[];
  previousQuotes: PlanQuote[] | null;
  selectedPlanId: PlanId;
  onSelect: (id: PlanId) => void;
}

export default function PlanCards({ quotes, previousQuotes, selectedPlanId, onSelect }: PlanCardsProps) {
  return (
    <div className="plan-cards">
      {quotes.map((quote) => {
        const previous = previousQuotes?.find((q) => q.plan.id === quote.plan.id) ?? null;
        const delta =
          quote.total !== null && previous !== null && previous.total !== null
            ? quote.total - previous.total
            : null;
        const selected = quote.plan.id === selectedPlanId;

        return (
          <button
            key={quote.plan.id}
            type="button"
            className={`plan-card${selected ? ' selected' : ''}`}
            onClick={() => onSelect(quote.plan.id)}
          >
            <div className="plan-card-head">
              <span className="plan-name">{quote.plan.name}</span>
              {quote.suppressed.length > 0 && (
                <span className="badge badge-warn">{quote.suppressed.length} 条互斥未生效</span>
              )}
            </div>
            <p className="plan-tagline">{quote.plan.tagline}</p>

            <div className="plan-price">
              {quote.status === 'ok' && quote.total !== null ? (
                <>
                  <span className="price-value">{formatCny(quote.total)}</span>
                  <span className="price-unit">/年</span>
                </>
              ) : quote.status === 'incomplete' ? (
                <span className="price-pending">
                  待补充：{quote.missingFields.map((field) => FIELD_LABELS[field]).join('、')}
                </span>
              ) : (
                <span className="price-invalid">当前条件无法承保</span>
              )}
            </div>

            <div className="plan-card-foot">
              {delta !== null && delta !== 0 ? (
                <span className={`plan-delta ${delta > 0 ? 'up' : 'down'}`}>
                  {delta > 0 ? '▲' : '▼'} {formatSignedCny(delta)} 较调整前
                </span>
              ) : (
                <span className="plan-delta-placeholder" />
              )}
              <span className="plan-cta">{selected ? '✓ 右侧查看规则解释' : '点击查看规则解释'}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
