// studioUi.ts — shared style tokens for the Spreadsheet Studio panels
// (r2: Workbooks / Scratch / Documents). Tokens only (var(--…)), no globals.

import type React from 'react';

export const UI: Record<string, React.CSSProperties> = {
  row: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 12, color: 'var(--ink-soft)', minWidth: 90 },
  select: {
    padding: '6px 8px', border: '1px solid var(--hairline)', borderRadius: 6,
    background: 'var(--paper)', color: 'var(--ink)', fontSize: 13, maxWidth: '100%',
  },
  input: {
    padding: '6px 8px', border: '1px solid var(--hairline)', borderRadius: 6,
    background: 'var(--paper)', color: 'var(--ink)', fontSize: 13,
  },
  btn: {
    padding: '7px 14px', borderRadius: 6, border: '1px solid var(--primary)',
    background: 'var(--primary)', color: 'var(--bg)', fontSize: 13, cursor: 'pointer',
  },
  btnGhost: {
    padding: '7px 14px', borderRadius: 6, border: '1px solid var(--hairline)',
    background: 'var(--paper)', color: 'var(--ink)', fontSize: 13, cursor: 'pointer',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
    borderRadius: 999, border: '1px solid var(--hairline)', fontSize: 12,
    background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer',
  },
  chipOn: {
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
    borderRadius: 999, border: '1px solid var(--primary)', fontSize: 12,
    background: 'var(--primary)', color: 'var(--bg)', cursor: 'pointer',
  },
  th: {
    textAlign: 'left', padding: '6px 10px', fontSize: 12, color: 'var(--ink-soft)',
    borderBottom: '1px solid var(--hairline)', whiteSpace: 'nowrap',
  },
  td: {
    padding: '5px 10px', fontSize: 13, borderBottom: '1px solid var(--hairline)',
    whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
  },
  err: { color: 'var(--terracotta)', fontSize: 13, marginTop: 8 },
  note: { color: 'var(--ink-soft)', fontSize: 12, marginTop: 8 },
  cell: {
    padding: '4px 6px', border: '1px solid var(--hairline)', fontSize: 13,
    background: 'var(--paper)', color: 'var(--ink)', minWidth: 90, width: '100%',
  },
};

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function fmtTs(ts: string | null): string {
  if (!ts) return '—';
  return ts.slice(0, 16).replace('T', ' ');
}
