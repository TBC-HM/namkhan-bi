'use client';

// StudioClient — Spreadsheet Studio v1 interactive builder.
// Pick view → columns → filters → group/aggregate → computed columns →
// run → save template → export stamped .xlsx. Tokens only (var(--…)),
// mobile-first, no browser storage (state lives in React + DB).

import { useCallback, useMemo, useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';
import type {
  StudioAggFn,
  StudioCatalogEntry,
  StudioFilter,
  StudioRow,
  StudioTemplateDefinition,
  StudioTemplateRow,
  StudioViewColumn,
} from '@/lib/studio/types';

interface Props {
  propertyId: number;
  catalog: StudioCatalogEntry[];
  initialTemplates: StudioTemplateRow[];
}

const OPS: StudioFilter['op'][] = ['=', '!=', '>', '>=', '<', '<=', 'ilike'];
const AGG_FNS: StudioAggFn[] = ['sum', 'avg', 'min', 'max', 'count'];

const S: Record<string, React.CSSProperties> = {
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
};

function fmtCell(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return String(v);
}

export default function StudioClient({ propertyId, catalog, initialTemplates }: Props) {
  const [schema, setSchema] = useState<'public' | 'kpi'>('kpi');
  const [view, setView] = useState('');
  const [viewCols, setViewCols] = useState<StudioViewColumn[]>([]);
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [filters, setFilters] = useState<StudioFilter[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggs, setAggs] = useState<{ col: string; fn: StudioAggFn }[]>([]);
  const [computed, setComputed] = useState<{ name: string; expr: string }[]>([]);
  const [rows, setRows] = useState<StudioRow[]>([]);
  const [outCols, setOutCols] = useState<string[]>([]);
  const [meta, setMeta] = useState<{ source_view: string; generated_at: string; row_count: number } | null>(null);
  const [templates, setTemplates] = useState<StudioTemplateRow[]>(initialTemplates);
  const [templateName, setTemplateName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewsForSchema = useMemo(
    () => catalog.filter((c) => c.view_schema === schema),
    [catalog, schema],
  );

  const definition: StudioTemplateDefinition = useMemo(
    () => ({
      schema, view,
      columns: selectedCols,
      filters,
      groupBy,
      aggregations: aggs,
      computed: computed.filter((c) => c.name && c.expr),
      limit: 1000,
    }),
    [schema, view, selectedCols, filters, groupBy, aggs, computed],
  );

  const loadColumns = useCallback(async (s: string, v: string) => {
    setViewCols([]);
    setSelectedCols([]);
    setGroupBy([]);
    setAggs([]);
    if (!v) return;
    const res = await fetch(`/api/reports/studio/columns?schema=${s}&view=${v}`);
    const json = (await res.json()) as { columns?: StudioViewColumn[]; error?: string };
    if (json.columns) setViewCols(json.columns);
  }, []);

  const hasPropertyCol = viewCols.some((c) => c.column_name === 'property_id');

  const run = useCallback(async () => {
    if (!view) { setError('Pick a source view first.'); return; }
    setBusy(true);
    setError(null);
    try {
      const def = { ...definition };
      if (hasPropertyCol && !def.filters.some((f) => f.col === 'property_id')) {
        def.filters = [...def.filters, { col: 'property_id', op: '=', value: String(propertyId) }];
      }
      const res = await fetch('/api/reports/studio/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ definition: def }),
      });
      const json = (await res.json()) as {
        rows?: StudioRow[]; columns?: string[]; row_count?: number;
        source_view?: string; generated_at?: string; error?: string;
      };
      if (!res.ok || json.error) throw new Error(json.error ?? 'query failed');
      setRows(json.rows ?? []);
      setOutCols(json.columns ?? []);
      setMeta({
        source_view: json.source_view ?? `${schema}.${view}`,
        generated_at: json.generated_at ?? '',
        row_count: json.row_count ?? 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'query failed');
    } finally {
      setBusy(false);
    }
  }, [definition, view, schema, propertyId, hasPropertyCol]);

  const exportXlsx = useCallback(async () => {
    if (!view) { setError('Pick a source view first.'); return; }
    setBusy(true);
    setError(null);
    try {
      const def = { ...definition };
      if (hasPropertyCol && !def.filters.some((f) => f.col === 'property_id')) {
        def.filters = [...def.filters, { col: 'property_id', op: '=', value: String(propertyId) }];
      }
      const res = await fetch('/api/reports/studio/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definition: def,
          title: templateName || `${view} export`,
          property_id: propertyId,
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? 'export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(templateName || view).replace(/[^a-z0-9]+/gi, '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'export failed');
    } finally {
      setBusy(false);
    }
  }, [definition, view, propertyId, templateName, hasPropertyCol]);

  const saveTemplate = useCallback(async () => {
    if (!view || !templateName.trim()) { setError('Name the template before saving.'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/reports/studio/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, name: templateName.trim(), definition }),
      });
      const json = (await res.json()) as { saved?: boolean; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? 'save failed');
      const list = await fetch(`/api/reports/studio/templates?property_id=${propertyId}`);
      const listJson = (await list.json()) as { templates?: StudioTemplateRow[] };
      if (listJson.templates) setTemplates(listJson.templates);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save failed');
    } finally {
      setBusy(false);
    }
  }, [definition, view, templateName, propertyId]);

  const loadTemplate = useCallback(async (t: StudioTemplateRow) => {
    const d = t.definition;
    setSchema(d.schema);
    setView(d.view);
    setTemplateName(t.name);
    setFilters(d.filters ?? []);
    setComputed(d.computed ?? []);
    await loadColumns(d.schema, d.view);
    setSelectedCols(d.columns ?? []);
    setGroupBy(d.groupBy ?? []);
    setAggs(d.aggregations ?? []);
  }, [loadColumns]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Container title="1 · Source" subtitle="Gold views only — read-only, catalog-driven">
        <div style={S.row}>
          <span style={S.label}>Schema</span>
          <select
            style={S.select}
            value={schema}
            onChange={(e) => {
              const s = e.target.value === 'public' ? 'public' : 'kpi';
              setSchema(s);
              setView('');
              setViewCols([]);
            }}
          >
            <option value="kpi">kpi (gold)</option>
            <option value="public">public (bridges)</option>
          </select>
          <span style={S.label}>View</span>
          <select
            style={{ ...S.select, minWidth: 220 }}
            value={view}
            onChange={(e) => { setView(e.target.value); void loadColumns(schema, e.target.value); }}
          >
            <option value="">— pick a view ({viewsForSchema.length}) —</option>
            {viewsForSchema.map((v) => (
              <option key={v.view_name} value={v.view_name}>
                {v.view_name}{v.kpi_name ? ` · ${v.kpi_name}` : ''}
              </option>
            ))}
          </select>
        </div>
        {viewCols.length > 0 && (
          <div style={{ ...S.row, alignItems: 'flex-start' }}>
            <span style={S.label}>Columns</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
              {viewCols.map((c) => {
                const on = selectedCols.length === 0 || selectedCols.includes(c.column_name);
                return (
                  <button
                    key={c.column_name}
                    type="button"
                    style={on ? S.chipOn : S.chip}
                    title={c.data_type}
                    onClick={() => {
                      const base = selectedCols.length === 0 ? viewCols.map((x) => x.column_name) : selectedCols;
                      const next = base.includes(c.column_name)
                        ? base.filter((x) => x !== c.column_name)
                        : [...base, c.column_name];
                      setSelectedCols(next.length === viewCols.length ? [] : next);
                    }}
                  >
                    {c.column_name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Container>

      <Container title="2 · Shape" subtitle="Filters, grouping, computed columns — all platform-computed">
        {filters.map((f, i) => (
          <div style={S.row} key={`f${i}`}>
            <span style={S.label}>{i === 0 ? 'Filters' : ''}</span>
            <select
              style={S.select}
              value={f.col}
              onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, col: e.target.value } : x)))}
            >
              {viewCols.map((c) => <option key={c.column_name} value={c.column_name}>{c.column_name}</option>)}
            </select>
            <select
              style={S.select}
              value={f.op}
              onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, op: e.target.value as StudioFilter['op'] } : x)))}
            >
              {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <input
              style={S.input}
              value={f.value}
              placeholder="value"
              onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
            />
            <button type="button" style={S.btnGhost} onClick={() => setFilters(filters.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div style={S.row}>
          <span style={S.label}>{filters.length === 0 ? 'Filters' : ''}</span>
          <button
            type="button"
            style={S.btnGhost}
            disabled={viewCols.length === 0}
            onClick={() => setFilters([...filters, { col: viewCols[0]?.column_name ?? '', op: '=', value: '' }])}
          >
            + filter
          </button>
          <span style={S.note}>property_id = {propertyId} is applied automatically when the view carries it.</span>
        </div>

        <div style={{ ...S.row, alignItems: 'flex-start' }}>
          <span style={S.label}>Group by</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
            {viewCols.map((c) => {
              const on = groupBy.includes(c.column_name);
              return (
                <button
                  key={c.column_name}
                  type="button"
                  style={on ? S.chipOn : S.chip}
                  onClick={() => setGroupBy(on ? groupBy.filter((g) => g !== c.column_name) : [...groupBy, c.column_name])}
                >
                  {c.column_name}
                </button>
              );
            })}
          </div>
        </div>

        {groupBy.length > 0 && (
          <>
            {aggs.map((a, i) => (
              <div style={S.row} key={`a${i}`}>
                <span style={S.label}>{i === 0 ? 'Aggregate' : ''}</span>
                <select
                  style={S.select}
                  value={a.fn}
                  onChange={(e) => setAggs(aggs.map((x, j) => (j === i ? { ...x, fn: e.target.value as StudioAggFn } : x)))}
                >
                  {AGG_FNS.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
                </select>
                <select
                  style={S.select}
                  value={a.col}
                  onChange={(e) => setAggs(aggs.map((x, j) => (j === i ? { ...x, col: e.target.value } : x)))}
                >
                  {viewCols.map((c) => <option key={c.column_name} value={c.column_name}>{c.column_name}</option>)}
                </select>
                <button type="button" style={S.btnGhost} onClick={() => setAggs(aggs.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <div style={S.row}>
              <span style={S.label}>{aggs.length === 0 ? 'Aggregate' : ''}</span>
              <button
                type="button"
                style={S.btnGhost}
                onClick={() => setAggs([...aggs, { col: viewCols[0]?.column_name ?? '', fn: 'sum' }])}
              >
                + aggregation
              </button>
            </div>
          </>
        )}

        {computed.map((c, i) => (
          <div style={S.row} key={`c${i}`}>
            <span style={S.label}>{i === 0 ? 'Computed' : ''}</span>
            <input
              style={S.input}
              value={c.name}
              placeholder="column name"
              onChange={(e) => setComputed(computed.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <input
              style={{ ...S.input, flex: 1, minWidth: 180 }}
              value={c.expr}
              placeholder="e.g. round(sum_revenue / sum_rooms_sold, 2)"
              onChange={(e) => setComputed(computed.map((x, j) => (j === i ? { ...x, expr: e.target.value } : x)))}
            />
            <button type="button" style={S.btnGhost} onClick={() => setComputed(computed.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div style={S.row}>
          <span style={S.label}>{computed.length === 0 ? 'Computed' : ''}</span>
          <button type="button" style={S.btnGhost} onClick={() => setComputed([...computed, { name: '', expr: '' }])}>
            + computed column
          </button>
          <span style={S.note}>Safe expressions only: + − × ÷, round/abs/min/max, column names. No SQL.</span>
        </div>
      </Container>

      <Container
        title="3 · Result"
        subtitle={meta ? `${meta.row_count} rows · ${meta.source_view} · generated ${meta.generated_at.slice(0, 19).replace('T', ' ')}` : 'Run to preview'}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={S.btn} disabled={busy} onClick={() => void run()}>
              {busy ? '…' : 'Run'}
            </button>
            <button type="button" style={S.btnGhost} disabled={busy || rows.length === 0} onClick={() => void exportXlsx()}>
              Export .xlsx
            </button>
          </div>
        }
      >
        {error && <div style={S.err}>{error}</div>}
        {rows.length > 0 && (
          <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>{outCols.map((c) => <th key={c} style={S.th}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((r, i) => (
                  <tr key={i}>
                    {outCols.map((c) => <td key={c} style={S.td}>{fmtCell(r[c])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 500 && <div style={S.note}>Showing first 500 of {rows.length} rows — export for the full set.</div>}
          </div>
        )}
        {rows.length === 0 && !error && <div style={S.note}>No result yet. Pick a view and press Run.</div>}
      </Container>

      <Container title="4 · Templates" subtitle="Saved definitions — version-forward, history kept">
        <div style={S.row}>
          <input
            style={{ ...S.input, minWidth: 220 }}
            value={templateName}
            placeholder="template name (e.g. Monthly occupancy pack)"
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <button type="button" style={S.btn} disabled={busy || !view} onClick={() => void saveTemplate()}>
            Save template
          </button>
        </div>
        {templates.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {templates.map((t) => (
              <button key={t.id} type="button" style={S.chip} onClick={() => void loadTemplate(t)}>
                {t.name} · v{t.version}
              </button>
            ))}
          </div>
        ) : (
          <div style={S.note}>No templates saved yet for this property.</div>
        )}
      </Container>
    </div>
  );
}
