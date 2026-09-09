// app/holding/finance/pl/_components/ui.tsx
// Shared chrome for the holding P&L tabs. Server components only — no state,
// no function props crossing to a client component.
// Tokens match the sibling holding-finance pages (costs/invoices/clients).

import Link from 'next/link';
import type { ReactNode } from 'react';

export const HAIR = '#E6DFCC';
export const INK_M = '#5A5A5A';
export const FOREST = '#084838';
export const RUST = '#8C3B2E';

export type TabKey = 'overview' | 'departments' | 'ar' | 'ledger' | 'upload';

export const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview',    label: 'Overview' },
  { key: 'departments', label: 'Departments' },
  { key: 'ar',          label: 'AR ageing' },
  { key: 'ledger',      label: 'Ledger' },
  { key: 'upload',      label: 'Upload' },
];

export const PL_PATH = '/holding/finance/pl';

/** Build a URL for this page preserving the active period. */
export function plHref(
  tab: TabKey,
  q: { from?: string | null; to?: string | null; [k: string]: string | null | undefined } = {},
): string {
  const sp = new URLSearchParams({ tab });
  for (const [k, v] of Object.entries(q)) if (v) sp.set(k, v);
  return `${PL_PATH}?${sp.toString()}`;
}

export function PlSubTabs({ current, from, to }: {
  current: TabKey; from: string | null; to: string | null;
}) {
  return (
    <div style={{
      display: 'flex', gap: 4, borderBottom: `1px solid ${HAIR}`,
      marginBottom: 4, flexWrap: 'wrap',
    }}>
      {TABS.map((t) => {
        const active = t.key === current;
        return (
          <Link key={t.key} href={plHref(t.key, { from, to })} style={{
            padding: '8px 14px', fontSize: 12, letterSpacing: '.05em',
            textTransform: 'uppercase', textDecoration: 'none',
            color: active ? FOREST : INK_M,
            borderBottom: active ? `2px solid ${FOREST}` : '2px solid transparent',
            fontWeight: active ? 700 : 500, marginBottom: -1,
          }}>{t.label}</Link>
        );
      })}
    </div>
  );
}

/** RPC / view failure. Shows the real message — never a substituted figure. */
export function ErrorPanel({ what, message }: { what: string; message: string }) {
  return (
    <div style={{
      border: `1px solid ${RUST}`, borderLeft: `3px solid ${RUST}`,
      padding: '12px 14px', fontSize: 13, background: '#FDF6F4',
    }}>
      <div style={{ fontWeight: 700, color: RUST, marginBottom: 4 }}>
        {what} could not be loaded
      </div>
      <div style={{ color: INK_M, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12 }}>
        {message}
      </div>
      <div style={{ color: INK_M, marginTop: 6 }}>
        No figure is shown for this section rather than a substituted one.
      </div>
    </div>
  );
}

/** Empty state — names what would fill it. Never renders as a zero row. */
export function EmptyLine({ what }: { what: string }) {
  return (
    <div style={{
      fontSize: 12, color: INK_M, padding: '10px 2px',
      borderBottom: `1px dashed ${HAIR}`,
    }}>{what}</div>
  );
}

/** Small inline badge — used for is_estimate / is_draft flags. */
export function Flag({ tone, children }: { tone: 'estimate' | 'draft' | 'neutral'; children: ReactNode }) {
  const c = tone === 'estimate' ? RUST : tone === 'draft' ? '#8A6D1F' : INK_M;
  const bg = tone === 'estimate' ? '#FDF1EE' : tone === 'draft' ? '#FBF6E7' : '#F4F2EC';
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 3,
      fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase',
      fontWeight: 700, color: c, background: bg, border: `1px solid ${c}33`,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

/** Explicit statement of which layer a summed figure belongs to (L15). */
export function LayerNote({ currency }: { currency: string }) {
  return (
    <div style={{ fontSize: 11, color: INK_M, marginTop: 6 }}>
      Totals are the <strong>{currency} reporting layer</strong>. Counterparties
      transact in their own currency; native amounts are shown per line.
    </div>
  );
}

export const TH: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', fontSize: 10, letterSpacing: '.06em',
  textTransform: 'uppercase', color: INK_M, fontWeight: 700,
  borderBottom: `1px solid ${HAIR}`, whiteSpace: 'nowrap',
};
export const TD: React.CSSProperties = {
  padding: '6px 8px', fontSize: 12, borderBottom: `1px solid ${HAIR}55`,
  verticalAlign: 'top',
};
export const TD_NUM: React.CSSProperties = {
  ...TD, textAlign: 'right', whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
};
export const TABLE: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', tableLayout: 'auto',
};
export const SCROLL_X: React.CSSProperties = { overflowX: 'auto', width: '100%' };
