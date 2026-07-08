// app/h/[property_id]/operations/restaurant/page.tsx
// PBS 2026-07-08 (Helper I) — Donna F&B ops. Reads gold views scoped to
// property_id=1000001 (v_dept_revenue_monthly / v_dept_top_seller_trend /
// v_dept_revenue_by_category_daily / v_fnb_raw_txn_enriched / v_ancillary_capture_daily).
// EUR currency throughout. Namkhan redirects to /operations/restaurant.
// Uses only server-formatted strings + primitives (no client fn props).

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

// ─── Simple server-rendered stacked bar chart (Food+Beverage per month) ───
function MonthlyRevenueBars({ rows }: { rows: Array<{ period: string; food: number; bev: number }> }) {
  if (rows.length === 0) return <div style={{ padding: 20, fontSize: 13, color: '#5A5A5A' }}>No monthly data.</div>;
  const maxRev = Math.max(...rows.map(r => r.food + r.bev), 1);
  const barW = 40, gap = 20, chartH = 180, padT = 20, padB = 30;
  const width = rows.length * (barW + gap) + gap;
  return (
    <div style={{ overflowX: 'auto', paddingTop: 8, paddingBottom: 8 }}>
      <svg width={width} height={chartH + padT + padB} style={{ display: 'block' }}>
        {rows.map((r, i) => {
          const x = gap + i * (barW + gap);
          const totalH = ((r.food + r.bev) / maxRev) * chartH;
          const foodH = (r.food / maxRev) * chartH;
          const bevH = (r.bev / maxRev) * chartH;
          const yFood = padT + chartH - foodH;
          const yBev = padT + chartH - totalH;
          return (
            <g key={r.period}>
              <rect x={x} y={yBev} width={barW} height={bevH} fill="#6b9379" />
              <rect x={x} y={yFood} width={barW} height={foodH} fill="#a8854a" />
              <text x={x + barW / 2} y={padT + chartH + 14} textAnchor="middle" fontSize="10" fill="#5A5A5A">
                {monthLabel(r.period)}
              </text>
              <text x={x + barW / 2} y={yBev - 4} textAnchor="middle" fontSize="10" fill="#000" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
                {fmtEurStr(r.food + r.bev)}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: '#5A5A5A' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#a8854a', marginRight: 4, verticalAlign: 'middle' }} />Food</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#6b9379', marginRight: 4, verticalAlign: 'middle' }} />Beverage</span>
      </div>
    </div>
  );
}

// ─── Simple top-seller table with pre-formatted € values ───
interface TopSellerRow { description: string; subdept: string | null; revStr: string; units: number; lastSold: string | null; }
function TopSellerTable({ rows, currency = '€' }: { rows: TopSellerRow[]; currency?: string }) {
  if (rows.length === 0) return <div style={{ padding: 20, fontSize: 13, color: '#5A5A5A' }}>No sellers found.</div>;
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #000', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#5A5A5A' };
  const thR: React.CSSProperties = { ...th, textAlign: 'right' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 13, color: '#000' };
  const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #E0E0E0', borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#FFFFFF' }}>
        <thead>
          <tr>
            <th style={th}>#</th>
            <th style={th}>Description</th>
            <th style={th}>Subdept</th>
            <th style={thR}>Revenue ({currency})</th>
            <th style={thR}>Units</th>
            <th style={thR}>Last sold</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.description + i}>
              <td style={td}>{i + 1}</td>
              <td style={td}>{r.description}</td>
              <td style={td}>{r.subdept ?? '—'}</td>
              <td style={tdR}>{r.revStr}</td>
              <td style={tdR}>{fmtInt(r.units)}</td>
              <td style={tdR}>{r.lastSold ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Category tile grid ───
function CategoryTiles({ rows }: { rows: Array<{ category: string; revenue: number; tx: number; sharePct: number }> }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 6 }}>
      {rows.map((c) => (
        <KpiTile key={c.category} label={c.category} value={c.revenue} currency="EUR"
          footnote={`${fmtPct(c.sharePct)} of F&B · ${fmtInt(c.tx)} tx`} status="grey" size="sm" />
      ))}
    </div>
  );
}

export default async function DonnaRestaurantPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/restaurant');

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

  const [monthlyResp, sellersResp, catResp, occResp, rawTxResp] = await Promise.all([
    supabase.from('v_dept_revenue_monthly')
      .select('period_yyyymm, usali_subdept, folio_revenue, tx_count')
      .eq('property_id', propertyId).eq('usali_dept', 'F&B')
      .order('period_yyyymm', { ascending: true }).then(r => r),
    supabase.from('v_dept_top_seller_trend')
      .select('description, usali_subdept, total_revenue_usd, total_units, last_sold, active_months, avg_rev_per_active_month')
      .eq('property_id', propertyId).eq('usali_dept', 'F&B')
      .order('total_revenue_usd', { ascending: false }).limit(200).then(r => r),
    supabase.from('v_dept_revenue_by_category_daily')
      .select('category, revenue_usd, tx_count, service_date')
      .eq('property_id', propertyId).eq('usali_dept', 'F&B')
      .gte('service_date', opFromIso).lte('service_date', opEndIso).then(r => r),
    supabase.from('v_ancillary_capture_daily')
      .select('night_date, occupied_rooms')
      .eq('property_id', propertyId)
      .gte('night_date', opFromIso).lte('night_date', opEndIso).then(r => r),
    supabase.from('v_fnb_raw_txn_enriched')
      .select('transaction_id, transaction_date, description, amount, category, usali_subdept, guest_name, room_name')
      .eq('property_id', propertyId).eq('usali_dept', 'F&B')
      .order('transaction_date', { ascending: false }).limit(50).then(r => r),
  ]);

  type MonthRow = { period_yyyymm: string; usali_subdept: string | null; folio_revenue: number | string; tx_count: number };
  type SellerRow = { description: string; usali_subdept: string | null; total_revenue_usd: number | string; total_units: number; last_sold: string | null; active_months: number; avg_rev_per_active_month: number | string };
  type CatRow = { category: string; revenue_usd: number | string; tx_count: number; service_date: string };
  type OccRow = { night_date: string; occupied_rooms: number };
  type TxRow = { transaction_id: string; transaction_date: string; description: string | null; amount: number | string; category: string | null; usali_subdept: string | null; guest_name: string | null; room_name: string | null };

  // Aggregate monthly Food + Bev
  const monthMap: Record<string, { food: number; bev: number; tx: number }> = {};
  for (const r of (monthlyResp.data ?? []) as MonthRow[]) {
    const m = String(r.period_yyyymm);
    if (!monthMap[m]) monthMap[m] = { food: 0, bev: 0, tx: 0 };
    const rev = Number(r.folio_revenue ?? 0);
    if (r.usali_subdept === 'Food') monthMap[m].food += rev;
    else if (r.usali_subdept === 'Beverage') monthMap[m].bev += rev;
    monthMap[m].tx += Number(r.tx_count ?? 0);
  }
  const monthRows = Object.entries(monthMap)
    .map(([period, v]) => ({ period, food: v.food, bev: v.bev, tx: v.tx }))
    .sort((a, b) => a.period.localeCompare(b.period));
  const totalRevAllTime = monthRows.reduce((s, r) => s + r.food + r.bev, 0);
  const totalFoodAllTime = monthRows.reduce((s, r) => s + r.food, 0);
  const totalBevAllTime = monthRows.reduce((s, r) => s + r.bev, 0);
  const totalTxAllTime = monthRows.reduce((s, r) => s + r.tx, 0);

  // Period-scoped tiles from category-daily
  const catRows = (catResp.data ?? []) as CatRow[];
  const periodRev = catRows.reduce((s, r) => s + Number(r.revenue_usd ?? 0), 0);
  const periodTx = catRows.reduce((s, r) => s + Number(r.tx_count ?? 0), 0);
  const catMap: Record<string, { revenue: number; tx: number }> = {};
  for (const r of catRows) {
    const c = String(r.category ?? '—');
    if (!catMap[c]) catMap[c] = { revenue: 0, tx: 0 };
    catMap[c].revenue += Number(r.revenue_usd ?? 0);
    catMap[c].tx += Number(r.tx_count ?? 0);
  }
  const catTiles = Object.entries(catMap)
    .map(([category, v]) => ({ category, revenue: v.revenue, tx: v.tx, sharePct: periodRev > 0 ? (v.revenue / periodRev) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Occupancy for capture
  const occRows = (occResp.data ?? []) as OccRow[];
  const occRn = occRows.reduce((s, r) => s + Number(r.occupied_rooms ?? 0), 0);
  const avgCheck = periodTx > 0 ? periodRev / periodTx : 0;
  const spendPerOcc = occRn > 0 ? periodRev / occRn : 0;

  // Sellers
  const sellers = ((sellersResp.data ?? []) as SellerRow[])
    .map(r => ({
      description: String(r.description ?? '—'),
      subdept: r.usali_subdept ?? null,
      revStr: fmtEurStr(Number(r.total_revenue_usd ?? 0)),
      units: Number(r.total_units ?? 0),
      lastSold: r.last_sold ?? null,
    }));
  const top10Sellers = sellers.slice(0, 10);

  const row1: KpiTileProps[] = [
    { label: 'F&B revenue', value: periodRev, currency: 'EUR', footnote: `Cloudbeds folio · ${opLabel}`, status: periodRev > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Transactions', value: fmtInt(periodTx), footnote: `POS lines · ${opLabel}`, status: periodTx > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Avg check', value: avgCheck, currency: 'EUR', footnote: `rev ÷ tx · ${opLabel}`, status: 'grey', size: 'sm' },
    { label: 'F&B / Occ Rn', value: spendPerOcc, currency: 'EUR', footnote: `spend per occupied room · ${opLabel}`, status: 'grey', size: 'sm' },
    { label: 'Occ room nights', value: fmtInt(occRn), footnote: `stay pattern · ${opLabel}`, status: 'grey', size: 'sm' },
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

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/restaurant'),
  }));

  const summaryStyle: React.CSSProperties = {
    cursor: 'pointer', padding: '10px 14px', fontSize: 12, fontWeight: 600,
    color: '#000', background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 6, letterSpacing: '0.04em',
  };

  const txRows = (rawTxResp.data ?? []) as TxRow[];

  return (
    <DashboardPage
      title="Restaurant · F&B"
      subtitle={`Operations · Restaurant · Cloudbeds folio + Mews items · Donna Portals · property_id=${propertyId}`}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Container title="Operating snapshot" subtitle={`Cloudbeds folio · revenue + capture · ${opLabel}`} density="compact" action={opPills}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row1.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
          {catTiles.length > 0 && (
            <>
              <div style={{ marginTop: 14, fontSize: 11, color: '#5A5A5A', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Revenue by category · {opLabel}
              </div>
              <CategoryTiles rows={catTiles} />
            </>
          )}
        </Container>

        <Container title="Monthly revenue · Food + Beverage" subtitle={`live from Cloudbeds folio (gl.v_dept_revenue_monthly) · all-time total ${fmtEurStr(totalRevAllTime)} · ${fmtInt(totalTxAllTime)} tx`} density="compact">
          <MonthlyRevenueBars rows={monthRows} />
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <KpiTile label="Total revenue" value={totalRevAllTime} currency="EUR" footnote={`${monthRows.length} months`} status="grey" size="sm" />
            <KpiTile label="Food revenue" value={totalFoodAllTime} currency="EUR" footnote="all-time" status="grey" size="sm" />
            <KpiTile label="Beverage revenue" value={totalBevAllTime} currency="EUR" footnote="all-time" status="grey" size="sm" />
          </div>
        </Container>

        <details open>
          <summary style={summaryStyle}>Top 10 sellers (all-time)</summary>
          <div style={{ marginTop: 10 }}>
            <TopSellerTable rows={top10Sellers} />
          </div>
        </details>

        {sellers.length > 10 && (
          <details>
            <summary style={summaryStyle}>All {sellers.length} sellers</summary>
            <div style={{ marginTop: 10 }}>
              <TopSellerTable rows={sellers} />
            </div>
          </details>
        )}

        {txRows.length > 0 && (
          <details>
            <summary style={summaryStyle}>
              Recent 50 POS transactions
              <span style={{ fontWeight: 400, color: '#5A5A5A', marginLeft: 6 }}>(most recent)</span>
            </summary>
            <div style={{ marginTop: 10, overflowX: 'auto', border: '1px solid #E0E0E0', borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#FFFFFF' }}>
                <thead>
                  <tr>
                    {['Date', 'Description', 'Category', 'Subdept', 'Guest', 'Room', 'Amount'].map((h) => (
                      <th key={h} style={{ textAlign: h === 'Amount' ? 'right' : 'left', padding: '8px 10px', borderBottom: '1px solid #000', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#5A5A5A' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txRows.map((r) => (
                    <tr key={r.transaction_id}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 12, color: '#000', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                        {String(r.transaction_date).slice(0, 16).replace('T', ' ')}
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 12 }}>{r.description ?? '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 12 }}>{r.category ?? '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 12 }}>{r.usali_subdept ?? '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 12 }}>{r.guest_name ?? '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 12 }}>{r.room_name ?? '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 12, textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                        {fmtEurStr(Number(r.amount ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </DashboardPage>
  );
}
