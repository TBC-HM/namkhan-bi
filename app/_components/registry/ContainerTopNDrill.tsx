// app/_components/registry/ContainerTopNDrill.tsx
// render_type='top_n_drill' — top 10 rows ranked, each expandable to a detail
// drill_view filtered by drill_key columns.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';
import { createClient } from '@/lib/supabase/client';
import { formatValue, safeText } from './format';
import {
  parseSort, propertyCurrencySymbol, stripPublicPrefix,
  type ContainerRegistryRow, type DataRow,
} from './types';

interface Props { container: ContainerRegistryRow; propertyId: number }

export default function ContainerTopNDrill({ container, propertyId }: Props) {
  const view = stripPublicPrefix(container.bound_views?.[0] ?? '');
  const drillView = container.drill_view ? stripPublicPrefix(container.drill_view) : null;
  const drillKeys = (container.drill_key ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const filterCol = container.primary_filter ?? 'property_id';
  const sort = useMemo(() => parseSort(container.default_sort), [container.default_sort]);
  const symbol = propertyCurrencySymbol(propertyId);
  const cols = container.columns_spec ?? [];

  const [rows, setRows] = useState<DataRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, DataRow[] | 'loading' | 'error'>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!view) return;
      const sb = createClient();
      let q = sb.from(view).select('*').eq(filterCol, propertyId).limit(10);
      if (sort) q = q.order(sort.col, { ascending: sort.ascending });
      const { data, error } = await q;
      if (cancelled) return;
      if (error) { setError(error.message); setRows([]); return; }
      setRows((data ?? []) as DataRow[]);
    })();
    return () => { cancelled = true; };
  }, [view, filterCol, propertyId, sort]);

  async function toggleExpand(idx: number, row: DataRow) {
    if (expanded === idx) {
      setExpanded(null);
      return;
    }
    setExpanded(idx);
    if (!drillView || drillKeys.length === 0) return;
    if (detailCache[idx] !== undefined) return;
    setDetailCache((c) => ({ ...c, [idx]: 'loading' }));
    try {
      const sb = createClient();
      let q = sb.from(drillView).select('*').eq(filterCol, propertyId);
      for (const k of drillKeys) {
        const v = row[k];
        if (v === null || v === undefined) continue;
        q = q.eq(k, v);
      }
      const { data, error } = await q.limit(500);
      setDetailCache((c) => ({ ...c, [idx]: error ? 'error' : ((data ?? []) as DataRow[]) }));
    } catch {
      setDetailCache((c) => ({ ...c, [idx]: 'error' }));
    }
  }

  if (!rows) {
    return (
      <Container title={container.container_name} subtitle={container.subtitle ?? undefined}>
        <div style={{ padding: 18, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' }}>Loading…</div>
      </Container>
    );
  }
  if (error) {
    return (
      <Container title={container.container_name} subtitle={container.subtitle ?? undefined}>
        <div style={{ padding: 18, fontSize: 12, color: 'var(--terracotta, #B8542A)' }}>Error: {error}</div>
      </Container>
    );
  }
  if (rows.length === 0) {
    return (
      <Container title={container.container_name} subtitle={container.subtitle ?? undefined}>
        <div style={{ padding: 18, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          No rows for this property.
        </div>
      </Container>
    );
  }

  return (
    <Container title={container.container_name} subtitle={container.subtitle ?? undefined}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--sans, "Inter Tight", system-ui)' }}>
          <thead>
            <tr style={{ background: '#FFFFFF', borderBottom: '2px solid #000' }}>
              <th style={th('left')}>#</th>
              {cols.map((c) => (
                <th key={c.key} style={th(c.align ?? 'left')}>{c.label}</th>
              ))}
              {drillView && <th style={th('right')}> </th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isOpen = expanded === i;
              const formatted = (c: typeof cols[number]) => {
                const v = r[c.key];
                return c.format === 'text' ? safeText(v) : formatValue(v, c.format, symbol);
              };
              return (
                <>
                  <tr
                    key={`row-${i}`}
                    onClick={drillView ? () => toggleExpand(i, r) : undefined}
                    style={{
                      cursor: drillView ? 'pointer' : 'default',
                      background: isOpen ? '#F5F5F5' : 'transparent',
                      borderBottom: '1px solid #E0E0E0',
                    }}
                  >
                    <td style={td('left')}>{i + 1}</td>
                    {cols.map((c) => (
                      <td key={c.key} style={td(c.align ?? 'left')}>{formatted(c)}</td>
                    ))}
                    {drillView && (
                      <td style={td('right')}>
                        <span style={{
                          fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: 'var(--ink-soft, #5A5A5A)',
                        }}>{isOpen ? '▾ hide' : '▸ details'}</span>
                      </td>
                    )}
                  </tr>
                  {isOpen && drillView && (
                    <tr key={`detail-${i}`}>
                      <td colSpan={cols.length + (drillView ? 2 : 1)} style={{ padding: 0, background: '#F5F5F5' }}>
                        <DrillDetail
                          state={detailCache[i]}
                          symbol={symbol}
                          parentRow={r}
                          drillKeys={drillKeys}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </Container>
  );
}

function DrillDetail({
  state, symbol, parentRow, drillKeys,
}: {
  state: DataRow[] | 'loading' | 'error' | undefined;
  symbol: string;
  parentRow: DataRow;
  drillKeys: string[];
}) {
  if (state === undefined || state === 'loading') {
    return <div style={{ padding: 12, fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>Loading details…</div>;
  }
  if (state === 'error') {
    return <div style={{ padding: 12, fontSize: 11, color: 'var(--terracotta, #B8542A)' }}>Error loading detail.</div>;
  }
  if (state.length === 0) {
    return <div style={{ padding: 12, fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
      No detail rows. Drilled on: {drillKeys.map((k) => `${k}=${String(parentRow[k] ?? '—')}`).join(' · ')}
    </div>;
  }
  // Render first 12 detail columns generically
  const keys = Object.keys(state[0]).slice(0, 12);
  return (
    <div style={{ padding: 12, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--mono, ui-monospace)' }}>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k} style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '1px solid #E0E0E0' }}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.slice(0, 200).map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #E0E0E0' }}>
              {keys.map((k) => {
                const v = row[k];
                const display = typeof v === 'number'
                  ? (k.endsWith('_eur') || k.endsWith('_usd') || k.endsWith('_lak') ? `${symbol}${Math.round(v).toLocaleString('en-US')}` : v.toLocaleString('en-US'))
                  : (v == null ? '—' : String(v));
                return (
                  <td key={k} style={{ padding: '4px 6px', color: 'var(--ink, #1B1B1B)' }}>{display}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {state.length > 200 && (
        <div style={{ padding: 8, fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          Showing 200 of {state.length} detail rows.
        </div>
      )}
    </div>
  );
}

function th(align: string): React.CSSProperties {
  return {
    textAlign: align as 'left' | 'right' | 'center',
    padding: '8px 10px',
    color: '#000',
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderBottom: '2px solid #000',
  };
}
function td(align: string): React.CSSProperties {
  return {
    textAlign: align as 'left' | 'right' | 'center',
    padding: '8px 10px',
    color: 'var(--ink, #1B1B1B)',
    fontVariantNumeric: 'tabular-nums',
  };
}
