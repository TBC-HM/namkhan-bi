// app/operations/activities/page.tsx
// PBS 2026-06-09 #191/#196 — Activities page with 3 mini-charts row (Capture / Avg ticket / Revenue by category).

import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import DeptTrendChart from '@/components/pl/DeptTrendChart';
import FnbGlBreakdown from '@/components/pl/FnbGlBreakdown';
import FnbTopSellerTrend from '@/components/pl/FnbTopSellerTrend';
import FnbRawTransactions from '@/components/pl/FnbRawTransactions';
import { FbCaptureChart, FbAvgTicketChart, FbCategoryChart } from '@/components/pl/FbMiniCharts';
import { supabase } from '@/lib/supabase';
import {
  getDeptPl, getDeptCaptureForPeriod,
  getDeptGlBreakdown, getDeptTopSellerTrend, getDeptRawTransactions,
  getDeptRevenueByCategoryForPeriod,
  type TopSellerTrend,
} from '@/lib/data';
import { resolvePeriod } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; propertyId?: number; }

const fmtUsd = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtPct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

export default async function ActivitiesPage({ searchParams, propertyId }: Props) {
  const pid = propertyId ?? 260955;
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
  const Q1_LABEL = 'Q1 2026 (Jan-Mar) · last fully-mapped GL quarter';

  const [pl, captureOp, topTrend, glBreakdown, rawTxns, catsPeriod, actCapResp, actAvgResp, actCatResp] = await Promise.all([
    getDeptPl('activities', 16).catch(() => []),
    getDeptCaptureForPeriod({ usali_dept: 'Activities' }, opFromIso, opEndIso).catch(() => null),
    getDeptTopSellerTrend({ usali_dept: 'Other Operated', usali_subdept: 'Activities' }, '2026-01-01', 500).catch(() => ({ periods: [], items: [] as TopSellerTrend[] })),
    getDeptGlBreakdown('Activities', 16).catch(() => ({ periods: [], lines: [] })),
    getDeptRawTransactions({ usali_dept: 'Other Operated', usali_subdept: 'Activities' }, 2000).catch(() => []),
    getDeptRevenueByCategoryForPeriod('Other Operated', opFromIso, opEndIso, 'Activities').catch(() => []),
    supabase.from('v_activity_capture_monthly')
      .select('period_yyyymm, capture_pct, res_in_house, res_with_purchase')
      .eq('property_id', pid)
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
    supabase.from('v_activity_avg_ticket_monthly')
      .select('period_yyyymm, avg_check, revenue, reservations')
      .eq('property_id', pid)
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
    supabase.from('v_activity_category_monthly')
      .select('period_yyyymm, category, revenue')
      .eq('property_id', pid)
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
  ]);

  const Q1_MONTHS = ['2026-01','2026-02','2026-03'];
  const q1Rows = pl.filter((r) => Q1_MONTHS.includes(r.period));
  const q1Revenue = q1Rows.reduce((s, r) => s + r.revenue, 0);
  const q1Payroll = q1Rows.reduce((s, r) => s + r.payroll, 0);
  const q1Cogs    = q1Rows.reduce((s, r) => s + r.cogs, 0);
  const q1Total   = q1Rows.reduce((s, r) => s + r.total_cost, 0);
  const q1Gop     = q1Revenue - q1Total;
  const q1LaborPct = q1Revenue > 0 ? (q1Payroll / q1Revenue) * 100 : 0;
  const q1CogsPct  = q1Revenue > 0 ? (q1Cogs / q1Revenue) * 100 : 0;
  const q1GopPct   = q1Revenue > 0 ? (q1Gop / q1Revenue) * 100 : 0;

  const revP    = captureOp ? Number(captureOp.revenue) : 0;
  const occRn   = captureOp ? Number(captureOp.roomnights) : 0;
  const bookings = captureOp ? Number(captureOp.res_with_purchase) : 0;
  const spc     = captureOp ? Number(captureOp.spend_per_occ) : 0;
  const capPct  = captureOp ? Number(captureOp.capture_pct) : 0;

  const row1: KpiTileProps[] = [
    { label: 'Activity Rev', value: fmtUsd(revP), footnote: `Cloudbeds folio · ${opLabel}`,
      status: revP > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Bookings', value: String(bookings), footnote: `occ rn w/ activity · ${opLabel}`,
      status: bookings > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Avg ticket', value: bookings > 0 ? fmtUsd(revP / bookings) : '—',
      footnote: `revenue ÷ bookings · ${opLabel}`, status: 'grey', size: 'sm' },
    { label: 'Activity / Occ Rn', value: fmtUsd(spc), footnote: `spend per occupied room · ${opLabel}`,
      status: spc >= 20 ? 'green' : 'grey', size: 'sm' },
    { label: 'Capture %', value: fmtPct(capPct), footnote: `${bookings}/${occRn} occ rn · ${opLabel}`,
      status: capPct >= 25 ? 'green' : 'grey', size: 'sm' },
  ];

  const row2: KpiTileProps[] = q1Revenue > 0 ? [
    { label: 'Activity Rev (QB)', value: fmtUsd(q1Revenue), footnote: 'Q1 2026 · QB GL', status: 'grey', size: 'sm' },
    { label: 'COGS',              value: fmtUsd(q1Cogs),    footnote: 'Q1 2026 · QB GL', status: 'grey', size: 'sm' },
    { label: 'Payroll',           value: fmtUsd(q1Payroll), footnote: 'Q1 2026 · QB GL', status: 'grey', size: 'sm' },
    { label: 'COGS %',            value: fmtPct(q1CogsPct), footnote: 'target ≤ 30%',
      status: q1CogsPct <= 30 ? 'green' : 'amber', size: 'sm' },
    { label: 'Labor %',           value: fmtPct(q1LaborPct), footnote: 'target ≤ 35%',
      status: q1LaborPct <= 35 ? 'green' : 'red', size: 'sm' },
    { label: 'GOP %',             value: fmtPct(q1GopPct), footnote: 'target ≥ 40%',
      status: q1GopPct >= 40 ? 'green' : q1GopPct >= 0 ? 'amber' : 'red', size: 'sm' },
  ] : [];

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

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/activities') })) as DashboardTab[];

  const summaryStyle: React.CSSProperties = {
    cursor: 'pointer', padding: '10px 14px', fontSize: 12, fontWeight: 600,
    color: '#000', background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 6, letterSpacing: '0.04em',
  };

  void period;

  return (
    <DashboardPage title="Activities & excursions" subtitle="Operations · Activities · live from QB GL + Cloudbeds folio · USALI rollup" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Container title="Operating snapshot" subtitle={`Cloudbeds folio · revenue + capture · ${opLabel}`} density="compact" action={opPills}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row1.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
          {catsPeriod.length > 0 && (
            <>
              <div style={{ marginTop: 14, fontSize: 11, color: '#5A5A5A', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Revenue by category · {opLabel}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 6 }}>
                {catsPeriod.map((c) => (
                  <KpiTile key={c.category} label={c.category}
                    value={fmtUsd(c.revenue_usd)}
                    footnote={`${c.share_pct.toFixed(1)}% of activity · ${c.tx_count} tx`}
                    status="grey" size="sm" />
                ))}
              </div>
            </>
          )}
        </Container>

        {/* 3 mini-charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          <Container title="Capture %" subtitle="since Jan 2025 · activity bookings ÷ occupied rooms" density="compact">
            <FbCaptureChart rows={(actCapResp?.data ?? []) as Array<{ period_yyyymm: string; capture_pct: number | string | null; res_in_house: number; res_with_purchase: number }>} />
          </Container>
          <Container title="Avg ticket" subtitle="since Jan 2025 · revenue ÷ bookings" density="compact">
            <FbAvgTicketChart rows={(actAvgResp?.data ?? []) as Array<{ period_yyyymm: string; avg_check: number | string | null; revenue: number | string; reservations: number | string }>} />
          </Container>
          <Container title="Revenue by category" subtitle="last 12 months · Inside / Mekong / External / Retreat" density="compact">
            <FbCategoryChart rows={(actCatResp?.data ?? []) as Array<{ period_yyyymm: string; category: string; revenue: number | string }>} />
          </Container>
        </div>

        {row2.length > 0 && (
          <Container title={`USALI Effective view · ${Q1_LABEL}`} subtitle="cost discipline derived from QB GL · scoped Q1 because GL Activities rows blank after April." density="compact">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {row2.map((t, i) => <KpiTile key={i} {...t} />)}
            </div>
          </Container>
        )}

        <Container title="Monthly trend · revenue · costs · GOP %" subtitle="last 16 months · live from Cloudbeds folio (gl.v_dept_revenue_monthly) · QB GL fallback when folio is empty">
          <DeptTrendChart rows={pl} dept="activities" />
        </Container>

        <details>
          <summary style={summaryStyle}>GL detail · Activities accounts (every QB line)</summary>
          <div style={{ marginTop: 10 }}><FnbGlBreakdown data={glBreakdown} defaultMonths={3} /></div>
        </details>

        <details open>
          <summary style={summaryStyle}>Top experiences · trend since Jan 26</summary>
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
