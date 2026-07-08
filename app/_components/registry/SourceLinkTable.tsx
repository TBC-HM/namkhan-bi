'use client';

// app/_components/registry/SourceLinkTable.tsx
// Compact table primitive where the first column (source name) is a Link.
// Used across /revenue/channels containers so every source name jumps
// straight to /revenue/channels/[source]. PBS 2026-07-01.
//
// PBS 2026-07-07: added optional `currency` prop so Donna (EUR) stops
// rendering '$' in the Category/Source drill tables. Default stays USD
// for backward-compat with the Namkhan call-sites.
//
// Style: hover underlines + brass accent + right-arrow chevron so PBS
// can see at a glance that names are clickable.

import TenantLink from '@/components/nav/TenantLink';
export interface SourceColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'text' | 'money' | 'pct' | 'int';
}

interface Row {
  [key: string]: string | number | null | undefined;
}

type MoneyCcy = 'USD' | 'EUR' | 'LAK';

interface Props {
  rows: Row[];
  columns: SourceColumn[];
  /** Which column holds the source name (used both as label and drill key). */
  sourceKey?: string;
  emptyText?: string;
  /** Property display currency for 'money' columns. Defaults to USD. */
  currency?: MoneyCcy;
}

function symbolFor(ccy: MoneyCcy): string {
  return ccy === 'EUR' ? '€' : ccy === 'LAK' ? '₭' : '$';
}

function fmt(v: unknown, f: SourceColumn['format'] | undefined, symbol: string): string {
  if (v == null || v === '') return '—';
  if (f === 'money')  return `${symbol}${Math.round(Number(v)).toLocaleString('en-US')}`;
  if (f === 'pct')    return `${Number(v).toFixed(1)}%`;
  if (f === 'int')    return Number(v).toLocaleString('en-US');
  return String(v);
}

export default function SourceLinkTable({
  rows, columns, sourceKey = 'source', emptyText = 'No data.',
  currency = 'USD',
}: Props) {
  if (rows.length === 0) {
    return (
      <div style={{
        padding: '24px 20px',
        background: '#FFFFFF',
        border: '1px solid #E6DFCC',
        borderRadius: 6,
        textAlign: 'center',
        color: '#5A5A5A',
        fontSize: 13,
      }}>
        {emptyText}
      </div>
    );
  }

  const symbol = symbolFor(currency);

  const th: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'right',
    fontFamily: 'var(--mono, monospace)', fontSize: 10,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: '#5A5A5A', fontWeight: 600,
    borderBottom: '1px solid #E6DFCC', background: '#FFFFFF',
  };
  const td: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'right', fontSize: 12,
    color: '#1B1B1B', fontVariantNumeric: 'tabular-nums',
    borderBottom: '1px solid #E6DFCC', background: '#FFFFFF',
  };
  const linkCell: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'left', fontSize: 13,
    borderBottom: '1px solid #E6DFCC', background: '#FFFFFF',
  };
  const linkStyle: React.CSSProperties = {
    color: '#1F3A2E', fontWeight: 600,
    textDecoration: 'underline', textDecorationColor: '#C79A6B',
    textDecorationThickness: 2, textUnderlineOffset: 3,
    display: 'inline-flex', alignItems: 'center', gap: 4,
  };

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 8, overflow: 'hidden' }}>
      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)' }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c.key} style={{ ...th, textAlign: i === 0 ? 'left' : (c.align ?? 'right') }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const rawSource = r[sourceKey];
            const source = rawSource != null ? String(rawSource) : '';
            return (
              <tr key={`${source}-${i}`}>
                {columns.map((c, ci) => {
                  const val = r[c.key];
                  if (ci === 0 && source) {
                    return (
                      <td key={c.key} style={linkCell}>
                        <TenantLink
                          href={`/revenue/channels/${encodeURIComponent(source)}`}
                          style={linkStyle}
                          title={`Open landing page for ${source}`}
                        >
                          {String(val ?? source)}
                          <span style={{ color: '#C79A6B', fontSize: 11 }}>→</span>
                        </TenantLink>
                      </td>
                    );
                  }
                  return (
                    <td key={c.key} style={{ ...td, textAlign: c.align ?? 'right' }}>
                      {fmt(val, c.format, symbol)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
