// components/sections/ActionCard.tsx
// Inline action card per Beyond Circle v9.
// Layout: 80px gutter (action-num) | body | CTA buttons
// Tone via .pillar-mark color (rev/ops/guest/fin/mkt/sys).

import { ReactNode } from 'react';

export type ActionPillar = 'rev' | 'ops' | 'guest' | 'fin' | 'mkt' | 'sys';
export type ActionPriority = 'high' | 'med' | 'low';

interface Verdict {
  label: string;
  tone?: 'good' | 'warn' | 'bad';
}

interface Props {
  num: string | number;        // "01", "02"
  pillar: ActionPillar;        // colored dot tone
  pillarLabel: string;         // "Revenue · Pricing"
  agentLabel?: string;         // "· Pricing Agent"
  priority?: ActionPriority;   // colored italic priority text
  priorityLabel?: string;      // "High priority", "48h aged"
  headline: ReactNode;         // big serif sentence with <em>italic accents</em>
  conclusion: ReactNode;       // small body with <strong>numbers</strong>
  verdict?: Verdict[];         // small chip strip
  primaryAction?: string;      // "Approve & deploy"
  secondaryAction?: string;    // "Adjust"
  tertiaryAction?: string;     // "Defer · See reasoning"
  impact?: string;             // "+$1,840"
  impactSub?: string;          // "est. 30-day net"
  href?: string;               // optional drill-down link
}

export default function ActionCard({
  num, pillar, pillarLabel, agentLabel, priority, priorityLabel,
  headline, conclusion, verdict,
  primaryAction = 'Approve', secondaryAction, tertiaryAction,
  impact, impactSub, href,
}: Props) {
  const pad = typeof num === 'number' ? String(num).padStart(2, '0') : num;

  const card = (
    <article className="action">
      <div className="action-num">{pad}</div>
      <div className="action-body">
        <div className="action-tag">
          <span className={`pillar-mark ${pillar}`} />
          <span>{pillarLabel}</span>
          {agentLabel && <span className="agent-name">{agentLabel}</span>}
          {priority && priorityLabel && (
            <span className={`priority ${priority}`}>{priorityLabel}</span>
          )}
        </div>
        <h3 className="action-headline">{headline}</h3>
        <p className="action-conclusion">{conclusion}</p>
        {verdict && verdict.length > 0 && (
          <div className="action-verdict">
            {verdict.map((v, i) => (
              <span key={i} className={v.tone || ''}>{v.label}</span>
            ))}
          </div>
        )}
      </div>
      <div className="action-cta">
        <button type="button" className="btn btn-primary">{primaryAction}</button>
        {secondaryAction && <button type="button" className="btn btn-ghost">{secondaryAction}</button>}
        {tertiaryAction && <button type="button" className="btn-text">{tertiaryAction}</button>}
        {impact && (
          <div className="action-impact">
            <strong>{impact}</strong>
            {impactSub}
          </div>
        )}
      </div>
    </article>
  );

  // For now no drill-through wired — kept as static cards
  return card;
}

// ===== Action stack wrapper =====
interface StackProps {
  title: ReactNode;          // headline like "The decisions queued for you."
  meta?: ReactNode;          // right side meta
  count?: number;
  children: ReactNode;
}

export function ActionStack({ title, meta, count, children }: StackProps) {
  return (
    <div className="actions">
      <div className="actions-head">
        <h2>{title}</h2>
        <div className="right">
          {count !== undefined && (
            <div className="now">{count} awaiting · live</div>
          )}
          {meta && <div>{meta}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}
