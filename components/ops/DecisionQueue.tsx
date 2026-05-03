// components/ops/DecisionQueue.tsx
// Block 6 — Decisions Queued For You.
// Each row: $ impact tag, title, meta line, Approve / Send back / Snooze / Detail.

import { ReactNode } from 'react';

export type DecisionUrgency = 'urg' | 'med' | 'neu';

export interface DecisionRow {
  id: string;
  impact: string;          // e.g. "SLA RISK", "$40 · RETENTION", "EFFICIENCY"
  urgency: DecisionUrgency;
  title: string;
  meta: string;            // sub-line — agent + confidence + room context
}

interface Props {
  rows: DecisionRow[];
  meta?: string;           // section meta line — e.g. "7 ranked by urgency · today"
  emptyOverlay?: ReactNode; // rendered when rows.length === 0 (data-needed case)
}

const impactColor: Record<DecisionUrgency, string> = {
  urg: '#a02d2d',
  med: '#a87024',
  neu: '#8a8170',
};

export default function DecisionQueue({ rows, meta, emptyOverlay }: Props) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '22px 0 10px',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--serif)',
            fontSize: "var(--t-xl)",
            fontWeight: 500,
            margin: 0,
          }}
        >
          Decisions queued <em style={{ color: '#a17a4f' }}>for you</em>
        </h3>
        {meta && (
          <span style={{ fontSize: "var(--t-base)", color: '#8a8170' }}>{meta}</span>
        )}
      </div>

      {rows.length === 0 ? (
        emptyOverlay
      ) : (
        <div
          style={{
            background: 'var(--paper-warm)',
            border: '1px solid #e6dfc9',
            borderRadius: 8,
          }}
        >
          {rows.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr auto',
                gap: 14,
                padding: '12px 16px',
                borderTop: i === 0 ? 0 : '1px solid #e6dfc9',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: "var(--t-base)",
                  fontWeight: 700,
                  color: impactColor[r.urgency],
                }}
              >
                {r.impact}
              </div>
              <div>
                <div style={{ fontSize: "var(--t-md)", fontWeight: 600, color: '#1c1c1a' }}>
                  {r.title}
                </div>
                <div style={{ fontSize: "var(--t-sm)", color: '#8a8170', marginTop: 2 }}>
                  {r.meta}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn primary" style={btnPrimary}>
                  Approve
                </button>
                <button type="button" className="btn" style={btnDefault}>
                  Send back
                </button>
                <button type="button" className="btn" style={btnDefault}>
                  Snooze
                </button>
                <button type="button" className="btn" style={btnDefault}>
                  Detail
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const btnDefault: React.CSSProperties = {
  fontSize: "var(--t-sm)",
  padding: '6px 11px',
  borderRadius: 5,
  border: '1px solid #e6dfc9',
  background: 'var(--paper-warm)',
  color: '#1c1c1a',
  cursor: 'pointer',
  textTransform: 'uppercase',
  fontWeight: 600,
  letterSpacing: '0.04em',
};

const btnPrimary: React.CSSProperties = {
  ...btnDefault,
  background: '#a17a4f',
  color: 'var(--paper-warm)',
  borderColor: '#a17a4f',
};
