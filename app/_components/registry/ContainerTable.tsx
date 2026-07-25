// app/_components/registry/ContainerTable.tsx
// render_type='table' — pre-format rows server-side; render via primitive table.
// PBS 2026-05-26 (#249): per-container year filter via columns_spec[].year_filter flag
// + URL param yr_<container_code>=YYYY. Renders pill strip above the table.
// PBS 2026-06-01 (#80): max_rows → ExpandableTableRows (first N + "show more").
// ADR-170 (2026-07-25): generic sort + filter primitives.
//   - Every header is a server-rendered sort link: ?sort_<cc>=<col>:<asc|desc>
//     (columns_spec[].sortable:false opts out; one sort per container).
//   - columns_spec[].source_filter:true → Source dropdown (?src_<cc>=<value>).
//   - columns_spec[].month_filter:true  → Month dropdown  (?mo_<cc>=YYYY-MM).
//   - Dropdown values come from public.fn_table_filter_values (DB-side DISTINCT,
//     immune to the PostgREST 1000-row page cap).
//   - Rows are paged via .range() so large views are no longer silently
//     truncated at 1000 rows (pre-existing bug, fixed here).
//   All state lives in the URL. Server-rendered, no client useState, deep-linkable.
//   Rendering is unified on ExpandableTableRows (headers accept ReactNode links;
//   containers without max_rows render all rows — no toggle appears).

import { Container } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import { formatValue, safeText } from './format';
import ExpandableTableRows from './ExpandableTableRows';
import TableFilterDropdown from './TableFilterDropdown';
import {
  parseSort, propertyCurrencySymbol, stripPublicPrefix,
  type ContainerRegistryRow, type DataRow,
} from './types';

interface Props {
  container: ContainerRegistryRow;
  propertyId: number;
  searchParams?: Record<string, string | string[] | undefined>;
}

const PAGE_SIZE = 1000; // PostgREST page cap
const MAX_PAGES = 25;   // 25k-row safety ceiling per container

function stringParams(searchParams?: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (typeof v === 'string' && v) out[k] = v;
  }
  return out;
}

function buildHref(base: Record<string, string>, overrides: Record<string, string | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) sp.set(k, v);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) sp.delete(k);
    else sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '?';
}

// First click on an unsorted column: text → a-z; numeric/money/date → big/newest first.
function firstClickDir(format: string): 'asc' | 'desc' {
  return format === 'text' ? 'asc' : 'desc';
}

// '2026-07' → exclusive upper bound '2026-08-01'
function nextMonthBound(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

export default async function ContainerTable({ container, propertyId, searchParams }: Props) {
  const boundView = container.bound_views?.[0] ?? '';
  const view = stripPublicPrefix(boundView);
  if (!view) return <EmptyShell c={container} reason="no bound view configured" />;

  const cc = container.container_code;
  const filterCol = container.primary_filter ?? 'property_id';
  const cols = container.columns_spec ?? [];
  const params = stringParams(searchParams);

  // ── URL param keys (ADR-170 + #249 conventions) ────────────────────────────
  const yrParamKey = `yr_${cc}`;
  const sortParamKey = `sort_${cc}`;
  const srcParamKey = `src_${cc}`;
  const moParamKey = `mo_${cc}`;

  // Year filter (#249, unchanged)
  const yearFilterCol = cols.find((c) => c.year_filter)?.key;
  const yrRaw = params[yrParamKey] ?? '';
  const yr = /^20\d{2}$/.test(yrRaw) ? Number(yrRaw) : null;

  // Sort (ADR-170): validate against columns_spec + sortable opt-out
  let urlSort: { col: string; ascending: boolean } | null = null;
  const sortMatch = /^([A-Za-z0-9_]+):(asc|desc)$/.exec(params[sortParamKey] ?? '');
  if (sortMatch) {
    const spec = cols.find((c) => c.key === sortMatch[1]);
    if (spec && spec.sortable !== false) {
      urlSort = { col: sortMatch[1], ascending: sortMatch[2] === 'asc' };
    }
  }
  const effSort = urlSort ?? parseSort(container.default_sort);

  // Source filter (ADR-170)
  const srcCol = cols.find((c) => c.source_filter)?.key;
  const srcRaw = params[srcParamKey] ?? '';
  const srcVal = srcCol && srcRaw && srcRaw !== 'all' ? srcRaw : null;

  // Month filter (ADR-170)
  const moCol = cols.find((c) => c.month_filter)?.key;
  const moRaw = params[moParamKey] ?? '';
  const moVal = moCol && /^20\d{2}-(0[1-9]|1[0-2])$/.test(moRaw) ? moRaw : null;

  // ── Data fetch: paged (fixes silent 1000-row truncation) ───────────────────
  const rows: DataRow[] = [];
  let fetchError: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    let q = supabase.from(view).select('*').eq(filterCol, propertyId);
    if (yearFilterCol && yr) {
      q = q.gte(yearFilterCol, `${yr}-01-01`).lt(yearFilterCol, `${yr + 1}-01-01`);
    }
    if (srcCol && srcVal) q = q.eq(srcCol, srcVal);
    if (moCol && moVal) q = q.gte(moCol, `${moVal}-01`).lt(moCol, nextMonthBound(moVal));
    if (effSort) q = q.order(effSort.col, { ascending: effSort.ascending, nullsFirst: false });
    const { data, error } = await q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) { fetchError = error.message; break; }
    const batch = (data ?? []) as DataRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  if (fetchError) return <EmptyShell c={container} reason={`query error: ${fetchError}`} />;

  // ── Dropdown option lists via fn_table_filter_values (DB-side DISTINCT) ────
  let srcOptions: string[] = [];
  if (srcCol) {
    const { data: opts } = await supabase.rpc('fn_table_filter_values', {
      p_view: boundView, p_column: srcCol, p_property_id: propertyId, p_month: false,
    });
    srcOptions = ((opts ?? []) as unknown[]).map(String);
  }
  let moOptions: string[] = [];
  if (moCol) {
    const { data: opts } = await supabase.rpc('fn_table_filter_values', {
      p_view: boundView, p_column: moCol, p_property_id: propertyId, p_month: true,
    });
    moOptions = ((opts ?? []) as unknown[]).map(String);
  }

  const symbol = propertyCurrencySymbol(propertyId);

  const formattedRows = rows.map((r) => {
    const out: Record<string, string | number> = {};
    for (const c of cols) {
      const v = r[c.key];
      out[c.key] = c.format === 'text' ? safeText(v) : formatValue(v, c.format, symbol);
    }
    return out;
  });

  // ── Sortable header links (server-rendered <a>, like the year pills) ───────
  const headerCols = cols.map((c) => {
    const align = c.align as 'left' | 'right' | 'center' | undefined;
    if (c.sortable === false) return { key: c.key, label: c.label, align };
    const isActive = effSort?.col === c.key;
    const nextDir: 'asc' | 'desc' = isActive
      ? (effSort!.ascending ? 'desc' : 'asc')
      : firstClickDir(c.format);
    return {
      key: c.key,
      align,
      label: (
        <a
          href={buildHref(params, { [sortParamKey]: `${c.key}:${nextDir}` })}
          className="ct-sortlink"
          style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', borderRadius: 3, padding: '1px 2px' }}
        >
          {c.label}
          {isActive && (
            <span style={{ color: 'var(--ink-soft, #5A5A5A)', fontSize: 9, marginLeft: 3 }}>
              {effSort!.ascending ? '▲' : '▼'}
            </span>
          )}
        </a>
      ),
    };
  });

  // ── Year pill strip (#249, unchanged behavior) ─────────────────────────────
  const yearPills = yearFilterCol ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>Year:</span>
      {(['all', '2024', '2025', '2026'] as const).map((y) => {
        const isActive = (y === 'all' && !yr) || String(yr) === y;
        const href = buildHref(params, { [yrParamKey]: y === 'all' ? null : y });
        return (
          <a key={y} href={href} style={{
            padding: '2px 9px', borderRadius: 999, border: '1px solid var(--hairline, #E6DFCC)',
            textDecoration: 'none', fontSize: 11,
            color: isActive ? 'var(--paper, #FFFFFF)' : 'var(--ink, #1B1B1B)',
            background: isActive ? 'var(--primary, #1F3A2E)' : 'transparent',
            fontWeight: isActive ? 600 : 400,
          }}>{y === 'all' ? 'All' : y}</a>
        );
      })}
    </div>
  ) : null;

  // ── Active-filter chips (ADR-170) ──────────────────────────────────────────
  const chips: Array<{ label: string; clearKey: string }> = [];
  if (srcVal) chips.push({ label: `Source: ${srcVal}`, clearKey: srcParamKey });
  if (moVal) chips.push({ label: `Month: ${moVal}`, clearKey: moParamKey });
  if (yr) chips.push({ label: `Year: ${yr}`, clearKey: yrParamKey });
  const chipStrip = chips.length > 0 ? (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '4px 4px 2px' }}>
      {chips.map((ch) => (
        <span key={ch.clearKey} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11,
          padding: '2px 4px 2px 10px', borderRadius: 999,
          border: '1px solid var(--hairline, #E6DFCC)', background: 'var(--paper, #FFFFFF)',
          color: 'var(--ink, #1B1B1B)',
        }}>
          {ch.label}
          <a
            href={buildHref(params, { [ch.clearKey]: null })}
            aria-label={`Clear ${ch.label}`}
            style={{ textDecoration: 'none', color: 'var(--ink-soft, #5A5A5A)', fontWeight: 700, padding: '0 6px', borderRadius: 999 }}
          >×</a>
        </span>
      ))}
    </div>
  ) : null;

  // ── Filter dropdowns → Container action slot (design_system §3.3) ──────────
  const action = (srcCol || moCol) ? (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {srcCol && (
        <TableFilterDropdown
          paramKey={srcParamKey} allLabel="All sources" options={srcOptions}
          active={srcVal ?? ''} preserveParams={params}
        />
      )}
      {moCol && (
        <TableFilterDropdown
          paramKey={moParamKey} allLabel="All months" options={moOptions}
          active={moVal ?? ''} preserveParams={params}
        />
      )}
    </div>
  ) : undefined;

  const hoverStyle = <style>{'.ct-sortlink:hover { background: var(--bg, #F4EFE2); }'}</style>;

  if (rows.length === 0) {
    const activeFilters = [srcVal && 'source', moVal && 'month', yr && 'year'].filter(Boolean).join(' + ');
    return (
      <Container title={container.container_name} subtitle={container.subtitle ?? undefined} action={action}>
        {hoverStyle}
        {yearPills}
        {chipStrip}
        <div style={{ padding: 18, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          {activeFilters ? `No rows for the current ${activeFilters} filter.` : 'No data for this property'}
        </div>
      </Container>
    );
  }

  // max_rows set → first N + "show more"; unset → all rows (no toggle appears)
  const maxRows = (container.max_rows ?? 0) > 0 ? (container.max_rows as number) : rows.length;
  return (
    <Container title={container.container_name} subtitle={container.subtitle ?? undefined} action={action}>
      {hoverStyle}
      {yearPills}
      {chipStrip}
      <ExpandableTableRows rows={formattedRows} cols={headerCols} maxRows={maxRows} />
    </Container>
  );
}

function EmptyShell({ c, reason }: { c: ContainerRegistryRow; reason: string }) {
  return (
    <Container title={c.container_name} subtitle={c.subtitle ?? undefined}>
      <div style={{ padding: 18, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
        {reason}
      </div>
    </Container>
  );
}
