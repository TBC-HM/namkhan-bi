// app/holding/it/cockpit/freshness/page.tsx
//
// Tenant data freshness matrix — for every operational table with
// property_id, shows which tenant filled how much data, until which date.
// PBS 2026-05-17: "I want to know which tenant filled which data until
// which date to know what is missing."
//
// Live read from public.v_tenant_data_coverage (returns ~215 rows · 60 tables × 2-3 tenants).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, SERIF, MONO } from '../_components/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CovRow {
  schema_name:   string;
  table_name:    string;
  property_id:   number | null;
  property_label:string;
  row_count:     number;
  earliest_date: string | null;
  latest_date:   string | null;
  date_column:   string;
}

async function fetchCoverage(): Promise<CovRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_tenant_data_coverage')
    .select('*')
    .order('schema_name')
    .order('table_name')
    .order('property_label');
  if (error) {
    console.error('[cockpit-v2/freshness] fetch error', error);
    return [];
  }
  return (data as CovRow[]) ?? [];
}

function staleness(latest: string | null): { tone: string; label: string } {
  if (!latest) return { tone: TOKENS.text3, label: '—' };
  const ageDays = (Date.now() - new Date(latest).getTime()) / 86_400_000;
  if (ageDays > 30)  return { tone: '#E07856',     label: `${Math.round(ageDays)}d ago` };  // peach-red — warn
  if (ageDays > 7)   return { tone: TOKENS.brass,  label: `${Math.round(ageDays)}d ago` };  // peach   — slow
  return                       { tone: TOKENS.forest, label: `${Math.round(ageDays)}d ago` }; // teal    — fresh
}

export default async function FreshnessPage() {
  const rows = await fetchCoverage();

  // pivot: table → { Namkhan: row, Donna: row, ... }
  const pivot = new Map<string, Record<string, CovRow>>();
  const tableOrder: string[] = [];
  for (const r of rows) {
    const key = `${r.schema_name}.${r.table_name}`;
    if (!pivot.has(key)) {
      pivot.set(key, {});
      tableOrder.push(key);
    }
    pivot.get(key)![r.property_label] = r;
  }

  // collect all property labels present
  const tenants = Array.from(new Set(rows.map((r) => r.property_label))).sort((a, b) => {
    const order = ['Namkhan', 'Donna', '(unscoped)'];
    const ai = order.indexOf(a); const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });

  // schema counts
  const schemaCount = new Map<string, number>();
  for (const key of tableOrder) {
    const [s] = key.split('.');
    schemaCount.set(s, (schemaCount.get(s) || 0) + 1);
  }

  return (
    <div style={{ padding: 24, color: TOKENS.text, background: TOKENS.bg, minHeight: '100vh' }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, margin: 0, color: TOKENS.ink, fontWeight: 500 }}>
          Tenant data freshness
        </h1>
        <p style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginTop: 6 }}>
          {tableOrder.length} tables · {tenants.length} tenants · live from{' '}
          <code>public.v_tenant_data_coverage</code> · who filled what, until when
        </p>
      </header>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Stat label="Tables" value={tableOrder.length} />
        <Stat label="Schemas" value={schemaCount.size} />
        <Stat label="Tenants tracked" value={tenants.length} />
        <Stat
          label="Total rows"
          value={rows.reduce((s, r) => s + (Number(r.row_count) || 0), 0).toLocaleString()}
        />
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${TOKENS.border}`, borderRadius: 2 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
          <thead>
            <tr style={{ background: TOKENS.bgRaised, borderBottom: `1px solid ${TOKENS.border}` }}>
              <th style={th()}>schema.table</th>
              <th style={{ ...th(), textAlign: 'right' }}>date column</th>
              {tenants.map((t) => (
                <th key={t} style={{ ...th(), textAlign: 'center' }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableOrder.map((key) => {
              const byTenant = pivot.get(key)!;
              const firstRow = Object.values(byTenant)[0];
              return (
                <tr key={key} style={{ borderBottom: `1px solid ${TOKENS.borderSoft}` }}>
                  <td style={{ ...td(), color: TOKENS.text }}>{key}</td>
                  <td style={{ ...td(), textAlign: 'right', color: TOKENS.text3 }}>
                    {firstRow.date_column === '(none)' ? '—' : firstRow.date_column}
                  </td>
                  {tenants.map((t) => {
                    const r = byTenant[t];
                    if (!r)
                      return (
                        <td key={t} style={{ ...td(), textAlign: 'center', color: TOKENS.text3 }}>
                          —
                        </td>
                      );
                    const s = staleness(r.latest_date);
                    return (
                      <td key={t} style={{ ...td(), textAlign: 'center' }}>
                        <div style={{ color: TOKENS.ink, fontWeight: 500 }}>
                          {r.row_count.toLocaleString()}
                        </div>
                        <div style={{ color: s.tone, fontSize: 10, marginTop: 2 }}>
                          {r.latest_date ? r.latest_date.slice(0, 10) : '(no date col)'}
                        </div>
                        <div style={{ color: s.tone, fontSize: 10 }}>{s.label}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 14, fontFamily: MONO, fontSize: 10, color: TOKENS.text3 }}>
        Colour legend: <span style={{ color: TOKENS.forest }}>teal = fresh (≤7d)</span> ·{' '}
        <span style={{ color: TOKENS.brass }}>peach = slow (7-30d)</span> ·{' '}
        <span style={{ color: '#E07856' }}>red = stale (&gt;30d)</span>. "—" means no data for that tenant
        OR the table has no recognisable timestamp column.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: TOKENS.bgRaised,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 2,
        minWidth: 120,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 22, color: TOKENS.ink, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function th(): React.CSSProperties {
  return {
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: TOKENS.text3,
  };
}

function td(): React.CSSProperties {
  return {
    padding: '8px 12px',
    fontVariantNumeric: 'tabular-nums',
    verticalAlign: 'top',
  };
}
