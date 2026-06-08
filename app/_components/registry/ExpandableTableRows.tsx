'use client';
// PBS 2026-06-01 #80 — table that shows the first N rows by default
// with a single toggle to reveal the remainder. Used by ContainerTable when
// kpi.container_registry.max_rows is set. Pre-formatted strings/numbers only —
// no function props cross the RSC boundary.

import { useState } from 'react';

interface Col {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: string;
}

interface Props {
  rows: Array<Record<string, string | number>>;
  cols: Col[];
  maxRows: number;
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontSize: 10,
  color: '#000',
  background: '#FFFFFF',
  fontWeight: 700,
  borderBottom: '2px solid #000',
  whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
};

export default function ExpandableTableRows({ rows, cols, maxRows }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, maxRows);
  const hidden = rows.length - visible.length;
  if (rows.length === 0) {
    return (
      <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
        No data
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} style={{ ...thStyle, textAlign: c.align ?? 'left' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid #E0E0E0' }}>
                {cols.map((c) => (
                  <td key={c.key} style={{ ...tdStyle, textAlign: c.align ?? 'left' }}>
                    {String(r[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          style={{
            marginTop: 6,
            background: 'transparent',
            border: '1px solid #000',
            borderRadius: 4,
            padding: '4px 12px',
            fontSize: 11,
            color: 'var(--ink-soft, #5A5A5A)',
            cursor: 'pointer',
            alignSelf: 'flex-start',
            fontFamily: 'inherit',
          }}
        >
          {expanded ? '↑ Show less' : `↓ Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}
