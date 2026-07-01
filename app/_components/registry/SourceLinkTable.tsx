'use client';

// app/_components/registry/SourceLinkTable.tsx
// Compact table primitive where the first column (source name) is a Link.
// Used across /revenue/channels containers so every source name jumps
// straight to /revenue/channels/[source]. PBS 2026-07-01.
//
// Style: hover underlines + brass accent + right-arrow chevron so PBS
// can see at a glance that names are clickable.

import Link from 'next/link';

export interface SourceColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'text' | 'money' | 'pct' | 'int';
}

interface Row {
  [key: string]: string | number | null | undefined;
}

interface Props {
  rows: Row[];
  columns: SourceColumn[];
  /** Which column holds the source name (used both as label and drill key). */
  sourceKey?: string;
  emptyText?: string;
}

function fmt(v: unknown, f?: SourceColumn['format']): string {
  if (v == null || v === '') return '—';
  if (f === 'money')  return `$${Math.round(Number(v)).toLocaleString('en-US')}`;
  if (f === 'pct')    return `${Number(v).toFixed(1)}%`;
  if (f === 'int')    return Number(v).toLocaleString('en-US');
  return String(v);
}

export default function SourceLinkTable({
  rows, columns, sourceKey = 'source', emptyText = 'No data.',
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
                        <Link
                          href={`/revenue/channels/${encodeURIComponent(source)}`}
                          style={linkStyle}
                          title={`Open landing page for ${source}`}
                        >
                          {String(val ?? source)}
                          <span style={{ color: '#C79A6B', fontSize: 11 }}>→</span>
                        </Link>
                      </td>
                    );
                  }
                  return (
                    <td key={c.key} style={{ ...td, textAlign: c.align ?? 'right' }}>
                      {fmt(val, c.format)}
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
