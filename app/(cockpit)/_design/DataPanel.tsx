// app/(cockpit)/_design/DataPanel.tsx
// A self-fetching table panel in the CURRENT design system.
//
// components/engine/EngineDashboard renders the same kind of panel, but in the old
// dark chrome (#2a261d / #7d7565 / JetBrains Mono) that reads as a different product
// next to Container and KpiTile. This is the same capability — point it at a public
// view, give it columns — rendered in the surface everything else uses.
//
// Server component: it does its own read, so a page can compose panels without
// threading a dozen queries through its own body.

import Container from './layout/Container';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type CellFormat = 'usd' | 'pct' | 'int' | 'text';

export interface DataColumn {
  key: string;
  label: string;
  format?: CellFormat;
}

interface Props {
  title: string;
  subtitle?: string;
  view: string;
  columns: DataColumn[];
  filter?: { col: string; eq: unknown };
  order_by?: { col: string; ascending?: boolean };
  limit?: number;
  /** Row is tinted when this column exceeds the threshold — for exception panels. */
  highlight?: { key: string; above: number };
  /** Shown instead of an empty table, so a dead panel says why rather than sitting blank. */
  emptyText?: string;
}

function fmt(v: unknown, kind: CellFormat = 'text'): string {
  if (v === null || v === undefined || v === '') return '—';
  if (kind === 'text') return String(v);
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (typeof n !== 'number' || Number.isNaN(n)) return String(v);
  switch (kind) {
    case 'usd': return `$${Math.round(n).toLocaleString('en-US')}`;
    case 'pct': return `${n.toFixed(1)}%`;
    case 'int': return Math.round(n).toLocaleString('en-US');
    default:    return String(v);
  }
}

export default async function DataPanel({
  title, subtitle, view, columns, filter, order_by, limit = 20, highlight, emptyText,
}: Props) {
  let rows: Array<Record<string, unknown>> = [];
  let failed = false;
  try {
    let q = getSupabaseAdmin().from(view as never).select('*');
    if (filter) q = (q as never as { eq: (c: string, v: unknown) => typeof q }).eq(filter.col, filter.eq);
    if (order_by) {
      q = (q as never as { order: (c: string, o: { ascending: boolean }) => typeof q })
        .order(order_by.col, { ascending: order_by.ascending ?? true });
    }
    const { data, error } = await (q as never as { limit: (n: number) => Promise<{ data: unknown; error: unknown }> }).limit(limit);
    if (error) failed = true;
    rows = (data ?? []) as Array<Record<string, unknown>>;
  } catch {
    failed = true;
  }

  return (
    <Container title={title} subtitle={subtitle} density="compact">
      {rows.length === 0 ? (
        <div style={emptyStyle}>
          {failed ? `Could not read ${view}.` : (emptyText ?? `No rows in ${view} yet.`)}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadRow}>
                {columns.map((c, i) => (
                  <th key={c.key} style={{ ...th, textAlign: i === 0 ? 'left' : 'right' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const hot = highlight ? Number(row[highlight.key] ?? 0) > highlight.above : false;
                return (
                  <tr key={ri} style={{ ...trRow, background: hot ? 'rgba(184,84,42,0.06)' : undefined }}>
                    {columns.map((c, i) => (
                      <td key={c.key} style={{
                        ...td,
                        textAlign: i === 0 ? 'left' : 'right',
                        color: hot && c.key === highlight?.key ? '#B8542A' : undefined,
                        fontWeight: hot && c.key === highlight?.key ? 700 : undefined,
                      }}>
                        {fmt(row[c.key], c.format)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}

const emptyStyle: React.CSSProperties = {
  padding: '14px 4px', color: 'var(--ink-soft, #5a5a5a)', fontStyle: 'italic', fontSize: 12,
};
const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 12,
};
const theadRow: React.CSSProperties = {
  borderBottom: '1px solid var(--ink-soft, #d4d4d8)',
};
const th: React.CSSProperties = {
  padding: '6px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--ink-soft, #5a5a5a)', whiteSpace: 'nowrap',
};
const trRow: React.CSSProperties = {
  borderBottom: '1px solid var(--ink-soft, #ececec)',
};
const td: React.CSSProperties = {
  padding: '6px 10px', fontSize: 12, color: 'var(--ink, #1b1b1b)',
  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
};
