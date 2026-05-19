// Body rendered inside the shared Drawer when a tile is clicked.
// Plain text + dl rows. Drawer chrome itself is the design primitive.

'use client';

import type { CSSProperties } from 'react';
import type { InventoryRow } from '../lib/types';

interface Props { row: InventoryRow }

function fieldRows(row: InventoryRow): Array<{ k: string; v: string }> {
  const out: Array<{ k: string; v: string }> = [
    { k: 'kind',          v: row.kind },
    { k: 'code',          v: row.code },
    { k: 'name',          v: row.name },
    { k: 'status_color',  v: row.status_color },
    { k: 'data_status',   v: row.data_status ?? '—' },
    { k: 'is_wired',      v: String(row.is_wired) },
  ];
  if (row.section)            out.push({ k: 'section',           v: row.section });
  if (row.page_slug)          out.push({ k: 'page_slug',         v: row.page_slug });
  if (row.chart_type)         out.push({ k: 'chart_type',        v: row.chart_type });
  if (row.primary_view)       out.push({ k: 'primary_view',      v: row.primary_view });
  if (row.served_by_namkhan !== null) out.push({ k: 'served_by_namkhan', v: String(row.served_by_namkhan) });
  if (row.served_by_donna   !== null) out.push({ k: 'served_by_donna',   v: String(row.served_by_donna) });
  return out;
}

export default function InventoryDrawerBody({ row }: Props) {
  const rows = fieldRows(row);
  const bound = row.bound_views ?? [];
  return (
    <div style={S.wrap}>
      {row.notes && <p style={S.notes}>{row.notes}</p>}

      <dl style={S.dl}>
        {rows.map(({ k, v }) => (
          <div key={k} style={S.dlRow}>
            <dt style={S.dt}>{k}</dt>
            <dd style={S.dd}>{v}</dd>
          </div>
        ))}
      </dl>

      {bound.length > 0 && (
        <section style={S.section}>
          <h3 style={S.sectionTitle}>Bound views ({bound.length})</h3>
          <ul style={S.list}>
            {bound.map((v) => <li key={v} style={S.listItem}>{v}</li>)}
          </ul>
        </section>
      )}

      <section style={S.section}>
        <h3 style={S.sectionTitle}>Raw row JSON</h3>
        <pre style={S.pre}>{JSON.stringify(row, null, 2)}</pre>
      </section>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  notes: { margin: 0, fontSize: 13, color: 'var(--ink, #1B1B1B)' },
  dl: { margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' },
  dlRow: { display: 'contents' },
  dt: { fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 },
  dd: { margin: 0, fontSize: 13, color: 'var(--ink, #1B1B1B)', wordBreak: 'break-all', fontVariantNumeric: 'tabular-nums' },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionTitle: { margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-soft, #5A5A5A)', fontWeight: 600 },
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 },
  listItem: { fontSize: 12, color: 'var(--ink, #1B1B1B)', fontFamily: 'var(--mono, ui-monospace, monospace)', wordBreak: 'break-all' },
  pre: { margin: 0, fontSize: 11, color: 'var(--ink, #1B1B1B)', background: 'var(--bg, #F4EFE2)', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 4, padding: 12, overflow: 'auto', maxHeight: 320, fontFamily: 'var(--mono, ui-monospace, monospace)' },
};
