// app/operations/spa/page.tsx
// PBS 2026-06-09 #190/#195 — mirrors restaurant. Now includes 3 mini-charts
// (Capture · Avg ticket · Top treatments) below the Operating snapshot,
// matching the F&B page anatomy.

import Link from 'next/link';
import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import DeptTrendChart from '@/components/pl/DeptTrendChart';
import FnbGlBreakdown from '@/components/pl/FnbGlBreakdown';
import FnbTopSellerTrend from '@/components/pl/FnbTopSellerTrend';
import FnbRawTransactions from '@/components/pl/FnbRawTransactions';
import { FbCaptureChart, FbAvgTicketChart, FbCategoryChart } from '@/components/pl/FbMiniCharts';
import { supabase } from '@/lib/supabase';
import {
  getDeptPl, getDeptCaptureForPeriod, getSpaCostsForPeriod,
  getDeptGlBreakdown, getDeptTopSellerTrend, getDeptRawTransactions,
  type TopSellerTrend,
} from '@/lib/data';
import { resolvePeriod } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

const fmtUsd = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtPct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

export default async function SpaPage({ searchParams }: Props) {
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
  const Q1_FROM = '2026-01-01', Q1_TO = '2026-03-31';
  const Q1_LABEL = 'Q1 2026 (Jan-Mar) · last fully-mapped GL quarter';

  const [pl, captureOp, periodCosts, topTrend, glBreakdown, rawTxns, topProductsOp, spaCapResp, spaAvgResp, spaTopMonthlyResp] = await Promise.all([
    getDeptPl('spa', 16).catch(() => []),
    getDeptCaptureForPeriod({ usali_dept: 'Spa' }, opFromIso, opEndIso).catch(() => null),
    getSpaCostsForPeriod(Q1_FROM, Q1_TO).catch(() => null),
    getDeptTopSellerTrend({ usali_dept: 'Other Operated', usali_subdept: 'Spa' }, '2026-01-01', 500).catch(() => ({ periods: [], items: [] as TopSellerTrend[] })),
    getDeptGlBreakdown('Spa', 16).catch(() => ({ periods: [], lines: [] })),
    getDeptRawTransactions({ usali_dept: 'Other Operated', usali_subdept: 'Spa' }, 2000).catch(() => []),
    getDeptTopSellerTrend({ usali_dept: 'Other Operated', usali_subdept: 'Spa' }, opFromIso, 50).catch(() => ({ periods: [], items: [] as TopSellerTrend[] })),
    supabase.from('v_spa_capture_monthly')
      .select('period_yyyymm, capture_pct, res_in_house, res_with_purchase')
      .eq('property_id', 260955)
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
    supabase.from('v_spa_avg_ticket_monthly')
      .select('period_yyyymm, avg_check, revenue, reservations')
      .eq('property_id', 260955)
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
    supabase.from('v_spa_top_treatments_monthly')
      .select('period_yyyymm, category, revenue')
      .eq('property_id', 260955)
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
  ]);
  const top10 = (topProductsOp.items ?? []).slice(0, 10);

  const revP    = captureOp ? Number(captureOp.revenue) : 0;
  const occRn   = captureOp ? Number(captureOp.roomnights) : 0;
  const treats  = captureOp ? Number(captureOp.res_with_purchase) : 0;
  const spc     = captureOp ? Number(captureOp.spend_per_occ) : 0;
  const capPct  = captureOp ? Number(captureOp.capture_pct) : 0;

  const row1: KpiTileProps[] = [
    { label: 'Spa Revenue',  value: fmtUsd(revP), footnote: `Cloudbeds folio · ${opLabel}`,
      status: revP > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Treatments',   value: String(treats), footnote: `occ rn w/ treatment · ${opLabel}`,
      status: treats > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Avg ticket',   value: treats > 0 ? fmtUsd(revP / treats) : '—',
      footnote: `revenue ÷ treatments · ${opLabel}`, status: 'grey', size: 'sm' },
    { label: 'Spa / Occ Rn', value: fmtUsd(spc), footnote: `spend per occupied room · ${opLabel}`,
      status: spc >= 25 ? 'green' : 'grey', size: 'sm' },
    { label: 'Capture %',    value: fmtPct(capPct), footnote: `${treats}/${occRn} occ rn · ${opLabel}`,
      status: capPct >= 35 ? 'green' : 'grey', size: 'sm' },
  ];

  const row2: KpiTileProps[] = periodCosts ? [
    { label: 'Spa Rev (QB)',  value: fmtUsd(periodCosts.revenue), footnote: 'Q1 2026 · QB GL', status: 'grey', size: 'sm' },
    { label: 'Spa COGS',      value: fmtUsd(periodCosts.spa_cost), footnote: 'Q1 2026 · QB GL', status: 'grey', size: 'sm' },
    { label: 'Payroll',       value: fmtUsd(periodCosts.payroll),  footnote: 'Q1 2026 · QB GL', status: 'grey', size: 'sm' },
    { label: 'Spa Cost %',    value: fmtPct(periodCosts.spa_cost_pct), footnote: 'target ≤ 12%',
      status: periodCosts.spa_cost_pct <= 12 ? 'green' : 'amber', size: 'sm' },
    { label: 'Labor %',       value: fmtPct(periodCosts.labor_cost_pct), footnote: 'target ≤ 35%',
      status: periodCosts.labor_cost_pct <= 35 ? 'green' : 'red', size: 'sm' },
    { label: 'GOP %',         value: fmtPct(periodCosts.gop_pct), footnote: 'target ≥ 50%',
      status: periodCosts.gop_pct >= 50 ? 'green' : periodCosts.gop_pct >= 0 ? 'amber' : 'red', size: 'sm' },
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
        <Link key={p} href={`?op=${p}`} style={opPillStyle(opPeriod === p)}>
          {p === 'yesterday' ? 'Yesterday' : p === '7d' ? '7d' : p === '30d' ? '30d' : 'YTD'}
        </Link>
      ))}
    </div>
  );

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/spa') })) as DashboardTab[];

  const summaryStyle: React.CSSProperties = {
    cursor: 'pointer', padding: '10px 14px', fontSize: 12, fontWeight: 600,
    color: '#000', background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 6, letterSpacing: '0.04em',
  };

  void period;

  return (
    <DashboardPage
      title="Wellness treatments"
      subtitle="Operations · Spa · live from QB GL + Cloudbeds folio · USALI rollup"
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Container title="Operating snapshot" subtitle={`Cloudbeds folio · revenue + capture · ${opLabel}`} density="compact" action={opPills}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row1.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
          {top10.length > 0 && (
            <>
              <div style={{ marginTop: 14, fontSize: 11, color: '#5A5A5A', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Top 10 treatments · {opLabel}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 6 }}>
                {top10.map((p) => (
                  <KpiTile key={p.description} label={p.description}
                    value={fmtUsd(p.total_revenue_usd)}
                    footnote={`${p.total_units} units · last ${p.last_sold ?? '—'}`}
                    status="grey" size="sm" />
                ))}
              </div>
            </>
          )}
        </Container>

        {/* 3 mini-charts row — mirrors F&B page anatomy */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          <Container title="Capture %" subtitle="since Jan 2025 · spa-capturing rooms ÷ occupied rooms" density="compact">
            <FbCaptureChart rows={(spaCapResp?.data ?? []) as Array<{ period_yyyymm: string; capture_pct: number | string | null; res_in_house: number; res_with_purchase: number }>} />
          </Container>
          <Container title="Avg ticket" subtitle="since Jan 2025 · revenue ÷ treatments served" density="compact">
            <FbAvgTicketChart rows={(spaAvgResp?.data ?? []) as Array<{ period_yyyymm: string; avg_check: number | string | null; revenue: number | string; reservations: number | string }>} />
          </Container>
          <Container title="Top treatments" subtitle="last 12 months · top 5 stacked" density="compact">
            <FbCategoryChart rows={(spaTopMonthlyResp?.data ?? []) as Array<{ period_yyyymm: string; category: string; revenue: number | string }>} />
          </Container>
        </div>

        {row2.length > 0 && (
          <Container title={`USALI Effective view · ${Q1_LABEL}`} subtitle="cost discipline derived from QB GL · scoped Q1 because GL Spa rows blank after April." density="compact">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {row2.map((t, i) => <KpiTile key={i} {...t} />)}
            </div>
          </Container>
        )}

        <Container title="Monthly trend · revenue · costs · GOP %" subtitle="last 16 months · live from Cloudbeds folio (gl.v_dept_revenue_monthly) · QB GL fallback when folio is empty">
          <DeptTrendChart rows={pl} dept="spa" />
        </Container>

        <details>
          <summary style={summaryStyle}>GL detail · Spa accounts (every QB line)</summary>
          <div style={{ marginTop: 10 }}>
            <FnbGlBreakdown data={glBreakdown} defaultMonths={3} />
          </div>
        </details>

        <details open>
          <summary style={summaryStyle}>Top treatments · trend since Jan 26</summary>
          <div style={{ marginTop: 10 }}>
            <FnbTopSellerTrend data={topTrend} hideSegments />
          </div>
        </details>

        <details>
          <summary style={summaryStyle}>
            All POS transactions · search &amp; reconcile
            <span style={{ fontWeight: 400, color: '#5A5A5A', marginLeft: 6 }}>({rawTxns.length} most recent)</span>
          </summary>
          <div style={{ marginTop: 10 }}>
            <FnbRawTransactions data={rawTxns} pageSize={200} />
          </div>
        </details>
      </div>
    </DashboardPage>
  );
}
