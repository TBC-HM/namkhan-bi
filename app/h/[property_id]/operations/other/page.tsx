// app/h/[property_id]/operations/other/page.tsx
// PBS 2026-07-08 (Helper I) — Donna Other Operated (everything not spa/transport/retail/activities/F&B/rooms).
// Aggregates: Other Operated Misc/Laundry/Pets/Rental, Fee (tips), Adjustment (cancellations/rebates).
// EUR currency. Namkhan redirects.

import TenantLink from '@/components/nav/TenantLink';
import { redirect } from 'next/navigation';
import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { supabase } from '@/lib/supabase';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

const fmtEurStr = (n: number) => `€${Math.round(Number(n) || 0).toLocaleString('en-GB')}`;
const fmtInt = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('en-GB')}`;
const fmtPct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

const monthLabel = (yyyymm: string): string => {
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return yyyymm;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

function MonthlyBars({ rows, colorRev }: { rows: Array<{ period: string; value: number }>; colorRev: string }) {
  if (rows.length === 0) return <div style={{ padding: 20, fontSize: 13, color: '#5A5A5A' }}>No monthly data.</div>;
  const maxRev = Math.max(...rows.map(r => r.value), 1);
  const barW = 40, gap = 24, chartH = 180, padT = 20, padB = 30;
  const width = rows.length * (barW + gap) + gap;
  return (
    <div style={{ overflowX: 'auto', paddingTop: 8, paddingBottom: 8 }}>
      <svg width={width} height={chartH + padT + padB} style={{ display: 'block' }}>
        {rows.map((r, i) => {
          const x = gap + i * (barW + gap);
          const h = (r.value / maxRev) * chartH;
          const y = padT + chartH - h;
          return (
            <g key={r.period}>
              <rect x={x} y={y} width={barW} height={h} fill={colorRev} />
              <text x={x + barW / 2} y={padT + chartH + 14} textAnchor="middle" fontSize="10" fill="#5A5A5A">{monthLabel(r.period)}</text>
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="#000" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{fmtEurStr(r.value)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface DeptBreakdownRow { dept: string; subdept: string | null; revStr: string; tx: number; }
function DeptBreakdownTable({ rows }: { rows: DeptBreakdownRow[] }) {
  if (rows.length === 0) return <div style={{ padding: 20, fontSize: 13, color: '#5A5A5A' }}>No data.</div>;
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #000', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#5A5A5A' };
  const thR: React.CSSProperties = { ...th, textAlign: 'right' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 13, color: '#000' };
  const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #E0E0E0', borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#FFFFFF' }}>
        <thead><tr><th style={th}>USALI dept</th><th style={th}>Subdept</th><th style={thR}>Revenue (€)</th><th style={thR}>Tx</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.dept + (r.subdept ?? '') + i}>
              <td style={td}>{r.dept}</td><td style={td}>{r.subdept ?? '—'}</td>
              <td style={tdR}>{r.revStr}</td><td style={tdR}>{fmtInt(r.tx)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DonnaOtherPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/other');

  const opPeriodRaw = typeof searchParams.op === 'string' ? searchParams.op : '30d';
  const opPeriod = (['yesterday', '7d', '30d', 'ytd'].includes(opPeriodRaw) ? opPeriodRaw : '30d') as 'yesterday' | '7d' | '30d' | 'ytd';
  const opToday = new Date(); opToday.setUTCHours(0, 0, 0, 0);
  const opToIso = opToday.toISOString().slice(0, 10);
  const opFromIso = (() => {
    const d = new Date(opToday);
    if (opPeriod === 'yesterday') { d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
    if (opPeriod === '7d') { d.setUTCDate(d.getUTCDate() - 6); return d.toISOString().slice(0, 10); }
    if (opPeriod === '30d') { d.setUTCDate(d.getUTCDate() - 29); return d.toISOString().slice(0, 10); }
    return `${opToday.getUTCFullYear()}-01-01`;
  })();
  const opEndIso = opPeriod === 'yesterday'
    ? (() => { const d = new Date(opToday); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })()
    : opToIso;
  const opLabel = opPeriod === 'yesterday' ? 'Yesterday' : opPeriod === '7d' ? 'Last 7 days' : opPeriod === '30d' ? 'Last 30 days' : 'YTD';

  // Fetch all revenue-monthly + category-daily rows. Filter client-side to
  // "Other Operated (excluding sub-pages) + Fee + Adjustment" bucket.
  const [monthlyResp, catResp] = await Promise.all([
    supabase.from('v_dept_revenue_monthly').select('period_yyyymm, usali_dept, usali_subdept, folio_revenue, tx_count')
      .eq('property_id', propertyId)
      .order('period_yyyymm', { ascending: true }).then(r => r),
    supabase.from('v_dept_revenue_by_category_daily').select('usali_dept, usali_subdept, category, revenue_usd, tx_count, service_date')
      .eq('property_id', propertyId)
      .gte('service_date', opFromIso).lte('service_date', opEndIso).then(r => r),
  ]);

  type MonthRow = { period_yyyymm: string; usali_dept: string; usali_subdept: string | null; folio_revenue: number | string; tx_count: number };
  type CatRow = { usali_dept: string; usali_subdept: string | null; category: string; revenue_usd: number | string; tx_count: number; service_date: string };

  // "Other" bucket = Other Operated except sub-pages, plus Fee + Adjustment
  const SUB_EXCLUDE = new Set(['Spa', 'Transportation', 'Activities', 'Retail']);
  const isOther = (dept: string, sub: string | null) => {
    if (dept === 'Fee' || dept === 'Adjustment') return true;
    if (dept === 'Other Operated') return !sub || !SUB_EXCLUDE.has(sub);
    return false;
  };

  const monthly = ((monthlyResp.data ?? []) as MonthRow[]).filter(r => isOther(String(r.usali_dept), r.usali_subdept));

  const monthMap: Record<string, { value: number; tx: number }> = {};
  const deptMap: Record<string, { dept: string; subdept: string | null; rev: number; tx: number }> = {};
  for (const r of monthly) {
    const m = String(r.period_yyyymm);
    if (!monthMap[m]) monthMap[m] = { value: 0, tx: 0 };
    monthMap[m].value += Number(r.folio_revenue ?? 0);
    monthMap[m].tx += Number(r.tx_count ?? 0);
    const key = `${r.usali_dept}|${r.usali_subdept ?? '—'}`;
    if (!deptMap[key]) deptMap[key] = { dept: String(r.usali_dept), subdept: r.usali_subdept, rev: 0, tx: 0 };
    deptMap[key].rev += Number(r.folio_revenue ?? 0);
    deptMap[key].tx += Number(r.tx_count ?? 0);
  }
  const monthRows = Object.entries(monthMap).map(([period, v]) => ({ period, value: v.value, tx: v.tx })).sort((a, b) => a.period.localeCompare(b.period));
  const totalRev = monthRows.reduce((s, r) => s + r.value, 0);
  const totalTx = monthRows.reduce((s, r) => s + r.tx, 0);

  const deptBreakdown: DeptBreakdownRow[] = Object.values(deptMap)
    .sort((a, b) => b.rev - a.rev)
    .map(d => ({ dept: d.dept, subdept: d.subdept, revStr: fmtEurStr(d.rev), tx: d.tx }));

  // Period-scoped from category-daily
  const cats = ((catResp.data ?? []) as CatRow[]).filter(r => isOther(String(r.usali_dept), r.usali_subdept));
  const periodRev = cats.reduce((s, r) => s + Number(r.revenue_usd ?? 0), 0);
  const periodTx = cats.reduce((s, r) => s + Number(r.tx_count ?? 0), 0);
  const catMap: Record<string, { revenue: number; tx: number; dept: string; subdept: string | null }> = {};
  for (const r of cats) {
    const c = String(r.category ?? '—');
    if (!catMap[c]) catMap[c] = { revenue: 0, tx: 0, dept: String(r.usali_dept), subdept: r.usali_subdept };
    catMap[c].revenue += Number(r.revenue_usd ?? 0);
    catMap[c].tx += Number(r.tx_count ?? 0);
  }
  const catTiles = Object.entries(catMap)
    .map(([category, v]) => ({ category, revenue: v.revenue, tx: v.tx, sharePct: periodRev > 0 ? (v.revenue / periodRev) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 12);

  const row1: KpiTileProps[] = [
    { label: 'Other-Op revenue', value: periodRev, currency: 'EUR', footnote: `Cloudbeds folio · ${opLabel}`, status: periodRev > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Transactions', value: fmtInt(periodTx), footnote: `POS lines · ${opLabel}`, status: periodTx > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'All-time total', value: totalRev, currency: 'EUR', footnote: `${monthRows.length} months`, status: 'grey', size: 'sm' },
    { label: 'All-time tx', value: fmtInt(totalTx), footnote: `${monthRows.length} months`, status: 'grey', size: 'sm' },
  ];

  const opPillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: active ? '#FFFFFF' : '#000', background: active ? '#000' : 'transparent',
    border: 'none', cursor: 'pointer', fontWeight: active ? 600 : 500, textDecoration: 'none',
  });
  const opPills = (
    <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 4, border: '1px solid #E0E0E0', overflow: 'hidden' }}>
      {(['yesterday', '7d', '30d', 'ytd'] as const).map((p) => (
        <TenantLink key={p} href={`?op=${p}`} style={opPillStyle(opPeriod === p)}>
          {p === 'yesterday' ? 'Yesterday' : p === '7d' ? '7d' : p === '30d' ? '30d' : 'YTD'}
        </TenantLink>
      ))}
    </div>
  );
  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/other') }));
  const summaryStyle: React.CSSProperties = { cursor: 'pointer', padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#000', background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 6, letterSpacing: '0.04em' };

  return (
    <DashboardPage title="Other operated" subtitle={`Operations · Other Op / Fee / Adjustment · Cloudbeds folio · Donna Portals · property_id=${propertyId}`} tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Container title="Operating snapshot" subtitle={`Cloudbeds folio · Other Op + Fee + Adjustment · ${opLabel}`} density="compact" action={opPills}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row1.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
          {catTiles.length > 0 && (
            <>
              <div style={{ marginTop: 14, fontSize: 11, color: '#5A5A5A', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Revenue by category · {opLabel}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 6 }}>
                {catTiles.map((c) => (
                  <KpiTile key={c.category} label={c.category} value={c.revenue} currency="EUR" footnote={`${fmtPct(c.sharePct)} of bucket · ${fmtInt(c.tx)} tx`} status="grey" size="sm" />
                ))}
              </div>
            </>
          )}
        </Container>

        <Container title="Monthly revenue" subtitle={`live from Cloudbeds folio · all-time total ${fmtEurStr(totalRev)}`} density="compact">
          <MonthlyBars rows={monthRows} colorRev="#5A5A5A" />
        </Container>

        <details open>
          <summary style={summaryStyle}>Dept / subdept breakdown</summary>
          <div style={{ marginTop: 10 }}><DeptBreakdownTable rows={deptBreakdown} /></div>
        </details>
      </div>
    </DashboardPage>
  );
}
