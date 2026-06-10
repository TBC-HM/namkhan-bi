// app/operations/transport/page.tsx
// PBS 2026-06-09 #197 — full Restaurant pattern. Transport = Other Operated/Transportation.
// GL is lumped into Other Operated (no isolated USALI line) so the USALI cost block + Monthly trend
// fall back to bronze-derived numbers.

import Link from 'next/link';
import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import FnbTopSellerTrend from '@/components/pl/FnbTopSellerTrend';
import FnbRawTransactions from '@/components/pl/FnbRawTransactions';
import { FbCaptureChart, FbAvgTicketChart, FbCategoryChart } from '@/components/pl/FbMiniCharts';
import { supabase } from '@/lib/supabase';
import {
  getDeptCaptureForPeriod, getDeptTopSellerTrend, getDeptRawTransactions, getDeptPl,
  type TopSellerTrend,
} from '@/lib/data';
import DeptTrendChart from '@/components/pl/DeptTrendChart';
import { resolvePeriod } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

const fmtUsd = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtPct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

export default async function TransportPage({ searchParams }: Props) {
  const opPeriodRaw = typeof searchParams.op === 'string' ? searchParams.op : '30d';
  const opPeriod = (['yesterday','7d','30d','ytd'].includes(opPeriodRaw) ? opPeriodRaw : '30d') as 'yesterday'|'7d'|'30d'|'ytd';
  const opToday = new Date(); opToday.setUTCHours(0,0,0,0);
  const opToIso = opToday.toISOString().slice(0,10);
  const opFromIso = (() => {
    const d = new Date(opToday);
    if (opPeriod === 'yesterday') { d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0,10); }
    if (opPeriod === '7d')  { d.setUTCDate(d.getUTCDate() - 6);  return d.toISOString().slice(0,10); }
    if (opPeriod === '30d') { d.setUTCDate(d.getUTCDate() - 29); return d.toISOString().slice(0,10); }
    return `${opToday.getUTCFullYear()}-01-01`;
  })();
  const opEndIso = opPeriod === 'yesterday'
    ? (() => { const d = new Date(opToday); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0,10); })()
    : opToIso;
  const opLabel = opPeriod === 'yesterday' ? 'Yesterday' : opPeriod === '7d' ? 'Last 7 days' : opPeriod === '30d' ? 'Last 30 days' : 'YTD';

  const period = resolvePeriod(searchParams);

  const [topTrend, rawTxns, topProductsOp, capProxy, capResp, avgResp, topItemsResp, pl] = await Promise.all([
    getDeptTopSellerTrend({ usali_dept: 'Other Operated', usali_subdept: 'Transportation' }, '2026-01-01', 500).catch(() => ({ periods: [], items: [] as TopSellerTrend[] })),
    getDeptRawTransactions({ usali_dept: 'Other Operated', usali_subdept: 'Transportation' }, 2000).catch(() => []),
    getDeptTopSellerTrend({ usali_dept: 'Other Operated', usali_subdept: 'Transportation' }, opFromIso, 50).catch(() => ({ periods: [], items: [] as TopSellerTrend[] })),
    getDeptCaptureForPeriod({ usali_dept: 'Activities' }, opFromIso, opEndIso).catch(() => null),
    supabase.from('v_transport_capture_monthly').select('period_yyyymm, capture_pct, res_in_house, res_with_purchase')
      .eq('property_id', 260955).order('period_yyyymm', { ascending: true }).then((r) => r),
    supabase.from('v_transport_avg_ticket_monthly').select('period_yyyymm, avg_check, revenue, reservations')
      .eq('property_id', 260955).order('period_yyyymm', { ascending: true }).then((r) => r),
    supabase.from('v_transport_top_items_monthly').select('period_yyyymm, category, revenue')
      .eq('property_id', 260955).order('period_yyyymm', { ascending: true }).then((r) => r),
  ]);
  const top10 = (topProductsOp.items ?? []).slice(0, 10);

  const periodRev = rawTxns
    .filter((t) => t.transaction_date.slice(0, 10) >= opFromIso && t.transaction_date.slice(0, 10) <= opEndIso)
    .reduce((s, t) => s + (t.amount ?? 0), 0);
  const periodBookings = new Set(
    rawTxns.filter((t) => t.transaction_date.slice(0, 10) >= opFromIso && t.transaction_date.slice(0, 10) <= opEndIso).map((t) => t.reservation_id).filter((x): x is string => !!x)
  ).size;
  const occRn = capProxy ? Number(capProxy.roomnights) : 0;
  const capPct = occRn > 0 ? (periodBookings / occRn) * 100 : 0;

  const row1: KpiTileProps[] = [
    { label: 'Transport Rev', value: fmtUsd(periodRev), footnote: `Cloudbeds folio · ${opLabel}`, status: periodRev > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Bookings', value: String(periodBookings), footnote: `unique reservations · ${opLabel}`, status: periodBookings > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Avg ticket', value: periodBookings > 0 ? fmtUsd(periodRev / periodBookings) : '—', footnote: `revenue ÷ bookings · ${opLabel}`, status: 'grey', size: 'sm' },
    { label: 'Transport / Occ Rn', value: occRn > 0 ? fmtUsd(periodRev / occRn) : '—', footnote: `spend per occupied room · ${opLabel}`, status: 'grey', size: 'sm' },
    { label: 'Capture %', value: fmtPct(capPct), footnote: `${periodBookings}/${occRn} occ rn · ${opLabel}`, status: 'grey', size: 'sm' },
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
        <Link key={p} href={`?op=${p}`} style={opPillStyle(opPeriod === p)}>{p === 'yesterday' ? 'Yesterday' : p === '7d' ? '7d' : p === '30d' ? '30d' : 'YTD'}</Link>
      ))}
    </div>
  );

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/transport') })) as DashboardTab[];

  const summaryStyle: React.CSSProperties = {
    cursor: 'pointer', padding: '10px 14px', fontSize: 12, fontWeight: 600,
    color: '#000', background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 6, letterSpacing: '0.04em',
  };

  void period;

  return (
    <DashboardPage title="Transport" subtitle="Operations · Transportation · live from Cloudbeds folio (GL lumped under Other Operated)" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Container title="Operating snapshot" subtitle={`Cloudbeds folio · revenue + capture · ${opLabel}`} density="compact" action={opPills}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row1.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
          {top10.length > 0 && (
            <>
              <div style={{ marginTop: 14, fontSize: 11, color: '#5A5A5A', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Top 10 transport bookings · {opLabel}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 6 }}>
                {top10.map((p) => (
                  <KpiTile key={p.description} label={p.description} value={fmtUsd(p.total_revenue_usd)}
                    footnote={`${p.total_units} units · last ${p.last_sold ?? '—'}`} status="grey" size="sm" />
                ))}
              </div>
            </>
          )}
        </Container>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          <Container title="Capture %" subtitle="since Jan 2025 · transport bookings ÷ occupied rooms" density="compact">
            <FbCaptureChart rows={(capResp?.data ?? []) as Array<{ period_yyyymm: string; capture_pct: number | string | null; res_in_house: number; res_with_purchase: number }>} />
          </Container>
          <Container title="Avg ticket" subtitle="since Jan 2025 · revenue ÷ transactions" density="compact">
            <FbAvgTicketChart rows={(avgResp?.data ?? []) as Array<{ period_yyyymm: string; avg_check: number | string | null; revenue: number | string; reservations: number | string }>} />
          </Container>
          <Container title="Top items" subtitle="last 12 months · top 5 stacked" density="compact">
            <FbCategoryChart rows={(topItemsResp?.data ?? []) as Array<{ period_yyyymm: string; category: string; revenue: number | string }>} />
          </Container>
        </div>

        {/* PBS 2026-06-10 #209 — Monthly trend backed by Cloudbeds folio (post-classifier).
            QB GL has no Transportation line (lumped into Other Operated) so folio is the only source. */}
        <Container title="Monthly trend · revenue · costs · GOP %" subtitle="last 16 months · live from Cloudbeds folio (gl.v_dept_revenue_monthly) · QB GL has no isolated Transportation line">
          <DeptTrendChart rows={pl} dept="transport" />
        </Container>

        <details open>
          <summary style={summaryStyle}>Top transport · trend since Jan 26</summary>
          <div style={{ marginTop: 10 }}><FnbTopSellerTrend data={topTrend} hideSegments /></div>
        </details>

        <details>
          <summary style={summaryStyle}>All POS transactions · search &amp; reconcile
            <span style={{ fontWeight: 400, color: '#5A5A5A', marginLeft: 6 }}>({rawTxns.length} most recent)</span></summary>
          <div style={{ marginTop: 10 }}><FnbRawTransactions data={rawTxns} pageSize={200} /></div>
        </details>
      </div>
    </DashboardPage>
  );
}
