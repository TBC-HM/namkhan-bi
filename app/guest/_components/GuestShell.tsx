// app/guest/_components/GuestShell.tsx
// Shared status-header + section-head primitives for /guest/* pages.
// Same shape as FinanceShell but in the Guest pillar.

import { ReactNode } from 'react';

export function GuestStatusHeader({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <div style={wrap}>
      <div style={row1}>{top}</div>
      <div style={row2}>{bottom}</div>
    </div>
  );
}

export function StatusCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className="t-eyebrow" style={{ marginRight: 6 }}>{label}</span>
      {children}
    </div>
  );
}

export function SectionHead({
  title, emphasis, sub, source,
}: {
  title: string; emphasis?: string; sub?: string; source?: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.1 }}>
          {title}
          {emphasis && (
            <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontStyle: 'normal', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>
              {emphasis}
            </span>
          )}
        </div>
        {sub && <div style={{ marginTop: 2, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{sub}</div>}
      </div>
      {source && (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          {source}
        </span>
      )}
    </div>
  );
}

export const metaSm: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)' };
export const metaStrong: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)', fontWeight: 600 };
export const metaDim: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', letterSpacing: 'var(--ls-loose)',
};
export const cardWrap: React.CSSProperties = {
  background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
  borderRadius: 8, padding: '14px 16px', minHeight: 220,
};
export const cardTitle: React.CSSProperties = { fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--ink)', marginBottom: 2 };
export const cardSub: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)',
  textTransform: 'uppercase', marginBottom: 10,
};

const wrap: React.CSSProperties = {
  background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
  borderRadius: 8, marginTop: 14, overflow: 'hidden',
};
const row1: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 18,
  padding: '10px 16px', borderBottom: '1px solid var(--paper-deep)', flexWrap: 'wrap',
};
const row2: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 16px', fontSize: 'var(--t-xs)', flexWrap: 'wrap',
};
