// app/sales/inquiries/_components/AutoDraftTray.tsx
// Block 8 right panel — drafts awaiting approval, sorted by confidence × $.

import { ReactNode } from 'react';

interface DraftRow {
  id: string;
  composer: string;       // "Composer 0.95" / "Group Strategist 0.92"
  title: string;
  meta: string;
  value: string;          // "$1,840"
  confidence: number;     // 0..1
  cta: string;            // "Safe to send" / "Needs review" / "RM approval"
}

const DRAFTS: DraftRow[] = [
  {
    id: 'D-2401',
    composer: 'Composer 0.95',
    title: 'Smith family · 3n river view',
    meta: 'Repeat guest · brand voice clean',
    value: '$1,840',
    confidence: 0.95,
    cta: 'Safe to send',
  },
  {
    id: 'D-2400',
    composer: 'Strategist 0.92',
    title: 'Hanoi Architects · Group',
    meta: 'Margin OK · 12 rooms × 3n + meeting',
    value: '$14,200',
    confidence: 0.92,
    cta: 'Approve & send',
  },
  {
    id: 'D-2398',
    composer: 'Strategist 0.78',
    title: 'Bangkok yoga retreat',
    meta: 'Margin tight · req RM 6% disc',
    value: '$4,600',
    confidence: 0.78,
    cta: 'RM approval',
  },
  {
    id: 'D-2397',
    composer: 'Composer 0.88',
    title: 'German honeymoon · Mekong pkg',
    meta: 'Package applied · stay 03-Aug',
    value: '$3,400',
    confidence: 0.88,
    cta: 'Approve & send',
  },
];

const ctaColor = (cta: string) =>
  cta === 'Safe to send'
    ? { bg: '#1f3d2e', fg: 'var(--paper-warm)' }
    : cta === 'Approve & send'
    ? { bg: '#2f6f4a', fg: 'var(--paper-warm)' }
    : { bg: '#a87024', fg: 'var(--paper-warm)' };

export default function AutoDraftTray({ overlay }: { overlay?: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--paper-warm)',
        border: '1px solid #e6dfc9',
        borderRadius: 8,
        marginTop: 14,
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid #e6dfc9',
        }}
      >
        <div
          style={{
            fontSize: "var(--t-sm)",
            color: '#8a8170',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Auto-draft tray
        </div>
        <h3
          style={{
            fontFamily: 'var(--serif)',
            fontSize: "var(--t-xl)",
            fontWeight: 500,
            margin: '2px 0 0',
          }}
        >
          Awaiting <em style={{ color: '#a17a4f' }}>approval</em>
        </h3>
      </div>

      {overlay ? <div style={{ padding: 12 }}>{overlay}</div> : null}

      {DRAFTS.map((d, i) => {
        const c = ctaColor(d.cta);
        return (
          <div
            key={d.id}
            style={{
              padding: '10px 14px',
              borderTop: i === 0 ? 0 : '1px solid #f0e8d0',
              fontSize: "var(--t-base)",
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 2,
              }}
            >
              <strong style={{ color: '#1c1815' }}>{d.title}</strong>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontWeight: 600,
                }}
              >
                {d.value}
              </span>
            </div>
            <div style={{ fontSize: "var(--t-sm)", color: '#4a4538' }}>{d.meta}</div>
            <div
              style={{
                fontSize: "var(--t-xs)",
                color: '#8a8170',
                marginTop: 2,
                fontFamily: 'ui-monospace, Menlo, monospace',
              }}
            >
              {d.composer}
            </div>
            <button
              type="button"
              style={{
                marginTop: 6,
                padding: '4px 10px',
                background: c.bg,
                color: c.fg,
                border: 0,
                borderRadius: 4,
                fontSize: "var(--t-sm)",
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: 'not-allowed',
                opacity: 0.85,
              }}
              disabled
              title="Wired post schema deploy"
            >
              {d.cta}
            </button>
          </div>
        );
      })}
    </div>
  );
}
