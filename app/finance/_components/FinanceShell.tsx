// app/finance/_components/FinanceShell.tsx
// Shared status-header + section-head primitives used by every /finance/* tab.
// Mirrors the visual shell of /revenue/compset/CompactAgentHeader.

import { ReactNode } from 'react';

interface StatusBlockProps {
  /** Top row content (left-aligned cells, optional flex spacer). */
  top: ReactNode;
  /** Bottom row content. */
  bottom: ReactNode;
}

export function FinanceStatusHeader({ top, bottom }: StatusBlockProps) {
  return (
    <div style={wrap}>
      <div style={row1}>{top}</div>
      <div style={row2}>{bottom}</div>
    </div>
  );
}

interface SectionHeadProps {
  title: string;
  emphasis?: string;
  sub?: string;
  source?: string;
}

export function SectionHead({ title, emphasis, sub, source }: SectionHeadProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 12,
        marginBottom: 6,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 'var(--t-xl)',
            fontWeight: 500,
            color: 'var(--ink)',
            lineHeight: 1.1,
          }}
        >
          {title}
          {emphasis && (
            <span
              style={{
                marginLeft: 8,
                fontFamily: 'var(--mono)',
                fontStyle: 'normal',
                fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)',
                textTransform: 'uppercase',
                color: 'var(--brass)',
              }}
            >
              {emphasis}
            </span>
          )}
        </div>
        {sub && (
          <div style={{ marginTop: 2, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
            {sub}
          </div>
        )}
      </div>
      {source && (
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-loose)',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
          }}
        >
          {source}
        </span>
      )}
    </div>
  );
}

// Inline cell helpers — use these in the top/bottom of FinanceStatusHeader.
export function StatusCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className="t-eyebrow" style={{ marginRight: 6 }}>{label}</span>
      {children}
    </div>
  );
}

export const metaSm: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)',
};
export const metaStrong: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)', fontWeight: 600,
};
export const metaDim: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  color: 'var(--ink-mute)',
  letterSpacing: 'var(--ls-loose)',
};

const wrap: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  marginTop: 14,
  overflow: 'hidden',
};
const row1: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  padding: '10px 16px',
  borderBottom: '1px solid var(--paper-deep)',
  flexWrap: 'wrap',
};
const row2: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  fontSize: 'var(--t-xs)',
  flexWrap: 'wrap',
};
