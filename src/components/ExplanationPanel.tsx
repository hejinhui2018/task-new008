import { useState } from 'react';
import { CATEGORY_LABELS, FIELD_LABELS, findRule, PLANS } from '../domain/data';
import { formatCny, formatEffect, formatSignedCny } from '../domain/format';
import type { PlanQuote, SkipReason } from '../domain/types';

interface ExplanationPanelProps {
  quote: PlanQuote;
  previousQuote: PlanQuote | null;
  /** 最近一次变更的字段级说明（如「年龄 35 → 40」）。 */
  changeLabel: string | null;
}

const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  'out-of-scope': '不适用本方案',
  'condition-not-met': '条件未满足',
  'missing-input': '缺少输入',
};

function scopeText(ruleId: string): string {
  const rule = findRule(ruleId);
  if (!rule || !rule.planIds) return '全部方案';
  return rule.planIds.map((id) => PLANS.find((p) => p.id === id)?.name ?? id).join('、');
}

function conflictsText(ruleId: string): string | null {
  const rule = findRule(ruleId);
  if (!rule || !rule.conflictsWith || rule.conflictsWith.length === 0) return null;
  return rule.conflictsWith.map((id) => findRule(id)?.name ?? id).join('、');
}

export default function ExplanationPanel({ quote, previousQuote, changeLabel }: ExplanationPanelProps) {
  const [openSteps, setOpenSteps] = useState<ReadonlySet<string>>(new Set());

  const toggleStep = (ruleId: string) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  };

  const delta =
    quote.total !== null && previousQuote !== null && previousQuote.total !== null
      ? quote.total - previousQuote.total
      : null;

  return (
    <div className="panel explanation-panel">
      <h2>规则解释 · {quote.plan.name}</h2>

      {quote.status === 'invalid' && (
        <div className="banner banner-danger">
          <strong>当前条件无法承保</strong>
          <ul>
            {quote.invalidReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {quote.status === 'incomplete' && (
        <div className="banner banner-warn">
          <strong>信息不完整，以下为部分试算</strong>
          <p>缺少：{quote.missingFields.map((field) => FIELD_LABELS[field]).join('、')}，补齐后给出准确保费。</p>
        </div>
      )}

      {previousQuote && (
        <div className="compare-strip">
          <div className="compare-title">调整前 / 调整后{changeLabel ? `（${changeLabel}）` : ''}</div>
          <div className="compare-body">
            <span className="compare-value">{previousQuote.total !== null ? formatCny(previousQuote.total) : '—'}</span>
            <span className="compare-arrow">→</span>
            <span className="compare-value">{quote.total !== null ? formatCny(quote.total) : '—'}</span>
            {delta !== null && delta !== 0 && (
              <span className={`compare-delta ${delta > 0 ? 'up' : 'down'}`}>{formatSignedCny(delta)}</span>
            )}
          </div>
        </div>
      )}

      <section className="explain-section">
        <h3>计算过程（按规则优先级依次叠加）</h3>
        {quote.steps.length === 0 ? (
          <p className="explain-empty">当前没有可应用的规则。</p>
        ) : (
          <ol className="step-list">
            {quote.steps.map((step, index) => {
              const open = openSteps.has(step.ruleId);
              const conflicts = conflictsText(step.ruleId);
              return (
                <li key={step.ruleId} className="step">
                  <button type="button" className="step-head" onClick={() => toggleStep(step.ruleId)}>
                    <span className="step-idx">{index + 1}</span>
                    <span className="step-name">{step.ruleName}</span>
                    <span className="step-effect">{formatEffect(step.effect)}</span>
                    <span className="step-money">
                      {formatCny(step.before)} → {formatCny(step.after)}
                    </span>
                    <span className={`chevron${open ? ' open' : ''}`}>▸</span>
                  </button>
                  {open && (
                    <div className="step-detail">
                      <p className="step-note">{step.note}</p>
                      <p>{findRule(step.ruleId)?.description}</p>
                      <dl>
                        <div>
                          <dt>规则分类</dt>
                          <dd>{CATEGORY_LABELS[step.category]}</dd>
                        </div>
                        <div>
                          <dt>优先级</dt>
                          <dd>{step.priority}</dd>
                        </div>
                        <div>
                          <dt>适用范围</dt>
                          <dd>{scopeText(step.ruleId)}</dd>
                        </div>
                        {conflicts && (
                          <div>
                            <dt>互斥规则</dt>
                            <dd>{conflicts}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <div className="total-row">
          <span>合计（年缴）</span>
          <strong>{quote.total !== null ? formatCny(quote.total) : '待补充信息后计算'}</strong>
        </div>
      </section>

      {quote.suppressed.length > 0 && (
        <section className="explain-section">
          <h3>互斥未生效</h3>
          {quote.suppressed.map((item) => (
            <div key={item.ruleId} className="banner banner-warn suppressed-item">
              <strong>{item.ruleName}</strong>
              <p>{item.reason}</p>
            </div>
          ))}
        </section>
      )}

      {quote.skipped.length > 0 && (
        <details className="skipped-block">
          <summary>未生效规则（{quote.skipped.length}）</summary>
          <ul className="skipped-list">
            {quote.skipped.map((item) => (
              <li key={item.ruleId}>
                <span className="skipped-name">{item.ruleName}</span>
                <span className={`badge badge-${item.reason}`}>{SKIP_REASON_LABELS[item.reason]}</span>
                <span className="skipped-detail">{item.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
