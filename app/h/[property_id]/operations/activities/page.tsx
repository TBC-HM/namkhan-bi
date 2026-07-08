// app/h/[property_id]/operations/activities/page.tsx
// PBS 2026-07-08 (Helper I) — Donna Activities ops. Thin data — only ~€165 classified.
// Renders what exists + a "sparse — needs Donna-specific classification" note.
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

const monthLabel = (yyyymm: string): string => {
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return yyyymm;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

interface TopSellerRow { description: string; revStr: string; units: number; lastSold: string | null; }
function TopSellerTable({ rows }: { rows: TopSellerRow[] }) {
  if (rows.length === 0) return <div style={{ padding: 20, fontSize: 13, color: '#5A5A5A' }}>No sellers found.</div>;
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #000', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#5A5A5A' };
  const thR: React.CSSProperties = { ...th, textAlign: 'right' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 13, color: '#000' };
  const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #E0E0E0', borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#FFFFFF' }}>
        <thead><tr><th style={th}>#</th><th style={th}>Description</th><th style={thR}>Revenue (€)</th><th style={thR}>Units</th><th style={thR}>Last sold</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.description + i}>
              <td style={td}>{i + 1}</td><td style={td}>{r.description}</td>
              <td style={tdR}>{r.revStr}</td><td style={tdR}>{fmtInt(r.units)}</td><td style={tdR}>{r.lastSold ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DonnaActivitiesPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/activities');

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

  const DEPT = 'Other Operated', SUB = 'Activities';
  const [monthlyResp, sellersResp, catResp] = await Promise.all([
    supabase.from('v_dept_revenue_monthly').select('period_yyyymm, folio_revenue, tx_count')
      .eq('property_id', propertyId).eq('usali_dept', DEPT).eq('usali_subdept', SUB)
      .order('period_yyyymm', { ascending: true }).then(r => r),
    supabase.from('v_dept_top_seller_trend').select('description, total_revenue_usd, total_units, last_sold')
      .eq('property_id', propertyId).eq('usali_dept', DEPT).eq('usali_subdept', SUB)
      .order('total_revenue_usd', { ascending: false }).limit(50).then(r => r),
    supabase.from('v_dept_revenue_by_category_daily').select('category, revenue_usd, tx_count')
      .eq('property_id', propertyId).eq('usali_dept', DEPT).eq('usali_subdept', SUB)
      .gte('service_date', opFromIso).lte('service_date', opEndIso).then(r => r),
  ]);

  type MonthRow = { period_yyyymm: string; folio_revenue: number | string; tx_count: number };
  type SellerRow = { description: string; total_revenue_usd: number | string; total_units: number; last_sold: string | null };
  type CatRow = { category: string; revenue_usd: number | string; tx_count: number };

  const monthly = (monthlyResp.data ?? []) as MonthRow[];
  const totalRev = monthly.reduce((s, r) => s + Number(r.folio_revenue ?? 0), 0);
  const totalTx = monthly.reduce((s, r) => s + Number(r.tx_count ?? 0), 0);

  const catRows = (catResp.data ?? []) as CatRow[];
  const periodRev = catRows.reduce((s, r) => s + Number(r.revenue_usd ?? 0), 0);
  const periodTx = catRows.reduce((s, r) => s + Number(r.tx_count ?? 0), 0);

  const sellers = ((sellersResp.data ?? []) as SellerRow[]).map(r => ({
    description: String(r.description ?? '—'),
    revStr: fmtEurStr(Number(r.total_revenue_usd ?? 0)),
    units: Number(r.total_units ?? 0),
    lastSold: r.last_sold ?? null,
  }));

  const row1: KpiTileProps[] = [
    { label: 'Activities rev', value: periodRev, currency: 'EUR', footnote: `Cloudbeds folio · ${opLabel}`, status: periodRev > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Bookings', value: fmtInt(periodTx), footnote: `POS lines · ${opLabel}`, status: periodTx > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'All-time rev', value: totalRev, currency: 'EUR', footnote: `${monthly.length} months`, status: 'grey', size: 'sm' },
    { label: 'All-time tx', value: fmtInt(totalTx), footnote: `${monthly.length} months`, status: 'grey', size: 'sm' },
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
  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/activities') }));

  const monthLine = monthly.map(r => `${monthLabel(String(r.period_yyyymm))}: ${fmtEurStr(Number(r.folio_revenue ?? 0))}`).join(' · ');

  return (
    <DashboardPage title="Activities" subtitle={`Operations · Activities · Cloudbeds folio · Donna Portals · property_id=${propertyId}`} tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Container title="Operating snapshot" subtitle={`Cloudbeds folio · ${opLabel}`} density="compact" action={opPills}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row1.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <Container title="Sparse data — needs Donna-specific classification" subtitle="only ~€165 classified as Activities" density="compact">
          <div style={{ padding: 16, fontSize: 13, color: '#000', lineHeight: 1.5 }}>
            <p style={{ margin: 0 }}>
              Donna Portals has very little revenue classified under <strong>Other Operated / Activities</strong>. Most bookable
              on-site experiences may be surfacing under Spa, F&amp;B (Pool / Beach Club) or Other Op Misc instead.
            </p>
            <p style={{ margin: '10px 0 0 0', fontSize: 12, color: '#5A5A5A' }}>
              Action for ops: send the ops team a short list of expected activities (guided tours, watersports, cooking classes,
              etc.) so a Donna-specific Pass 2 classifier rule can route those Mews items to the Activities bucket.
            </p>
            {monthLine && (
              <p style={{ margin: '10px 0 0 0', fontSize: 12, color: '#5A5A5A', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                Monthly slice: {monthLine}
              </p>
            )}
          </div>
        </Container>

        {sellers.length > 0 && (
          <Container title="Items classified today" subtitle={`${sellers.length} items · all-time`} density="compact">
            <TopSellerTable rows={sellers} />
          </Container>
        )}
      </div>
    </DashboardPage>
  );
}
