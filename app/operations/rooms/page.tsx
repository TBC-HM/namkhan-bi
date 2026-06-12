// app/operations/rooms/page.tsx
//
// PBS 2026-06-11 #211 — Operations · Rooms.
// Ops Manager view: occupancy, ADR, RevPAR, ALOS, room-type mix, P&L. Mirrors
// /operations/restaurant anatomy. Built on the same primitives (DashboardPage,
// Container, KpiTile, DeptTrendChart, FnbRawTransactions) so behavior matches
// the rest of the operations area.
//
// Data sources:
//  · Operating snapshot   → public.mv_kpi_daily (PMS-booked, the truth)
//  · Folio rooms revenue  → pms.transactions_cb usali_dept='Rooms' (rate postings)
//  · GL rooms revenue     → gl.mv_usali_pl_monthly usali_department='Rooms'
//  · Monthly trend        → getDeptPl('rooms', 16) (QB GL + folio overlay)
//  · Top room types       → public.v_room_type_performance_monthly
//  · Raw txns             → public.v_fnb_raw_txn_enriched (filter usali_dept='Rooms')

import React from 'react';
import Link from 'next/link';
import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import DeptTrendChart from '@/components/pl/DeptTrendChart';
import FnbRawTransactions from '@/components/pl/FnbRawTransactions';
import { supabase } from '@/lib/supabase';
import {
  getKpiDaily, aggregateDaily, getDeptPl,
} from '@/lib/data';
import { resolvePeriod } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

const fmtUsd = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtInt = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtPct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;
const fmt1   = (n: number) => `${(Number(n) || 0).toFixed(1)}`;

export default async function RoomsPage({ searchParams }: Props) {
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

  // PBS 2026-06-11 #211 — Q1 is the last fully-mapped GL quarter for the USALI block
  const Q1_FROM = '2026-01-01';
  const Q1_TO   = '2026-03-31';
  const Q1_LABEL = 'Q1 2026 (Jan-Mar) · last fully-mapped GL quarter';

  const period = resolvePeriod(searchParams);

  const [daily, pl, topRtRespYtd, topRtRespMonthly, glRevQ1, glCostQ1, rawTxns, folioRowsResp, reconResp] = await Promise.all([
    getKpiDaily(opFromIso, opEndIso).catch(() => []),
    getDeptPl('rooms', 16).catch(() => []),
    // YTD top room types from canonical perf view
    supabase.from('v_room_type_performance_monthly')
      .select('canonical_room_type_code, room_type_name, room_nights, room_revenue, adr, bookings, avg_los')
      .eq('property_id', 260955)
      .gte('period_yyyymm', '2026-01')
      .lte('period_yyyymm', opToIso.slice(0,7))
      .then((r) => r),
    // Monthly (for the trend section + room type mix)
    supabase.from('v_room_type_performance_monthly')
      .select('period_yyyymm, room_type_name, room_nights, room_revenue')
      .eq('property_id', 260955)
      .gte('period_yyyymm', '2025-06')
      .lte('period_yyyymm', opToIso.slice(0,7))
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
    supabase.schema('gl').from('mv_usali_pl_monthly')
      .select('usali_line_label, amount_usd, account_name')
      .eq('usali_department', 'Rooms').eq('usali_subcategory', 'Revenue')
      .in('period_yyyymm', ['2026-01','2026-02','2026-03'])
      .then((r) => r),
    supabase.schema('gl').from('mv_usali_pl_monthly')
      .select('usali_subcategory, usali_line_label, account_name, amount_usd')
      .eq('usali_department', 'Rooms')
      .neq('usali_subcategory', 'Revenue')
      .in('period_yyyymm', ['2026-01','2026-02','2026-03'])
      .then((r) => r),
    supabase.from('v_fnb_raw_txn_enriched')
      .select('transaction_id, reservation_id, transaction_date, local_laos_str, description, amount, currency, category, item_category_name, user_name, usali_dept, usali_subdept, guest_name, room_name, source_name')
      .eq('property_id', 260955)
      .eq('usali_dept', 'Rooms')
      .order('transaction_date', { ascending: false }).limit(2000)
      .then((r) => r),
    // Op-scoped folio rooms rev (for reconciliation top tile)
    supabase.from('v_dept_revenue_monthly')
      .select('period_yyyymm, folio_revenue, tx_count')
      .eq('property_id', 260955).eq('usali_dept', 'Rooms')
      .gte('period_yyyymm', '2025-06').lte('period_yyyymm', opToIso.slice(0,7))
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
    // Folio ↔ GL monthly reconciliation rows
    supabase.from('v_dept_revenue_monthly')
      .select('period_yyyymm, folio_revenue')
      .eq('property_id', 260955).eq('usali_dept', 'Rooms')
      .gte('period_yyyymm', '2025-06').order('period_yyyymm', { ascending: true })
      .then((r) => r),
  ]);
  void period; void folioRowsResp;

  type GlRevRow = { usali_line_label: string | null; amount_usd: number | string | null; account_name: string | null };
  type GlCostRow = { usali_subcategory: string; usali_line_label: string | null; account_name: string | null; amount_usd: number | string | null };
  type RtRow = { canonical_room_type_code: string | null; room_type_name: string | null; room_nights: number | string | null; room_revenue: number | string | null; adr: number | string | null; bookings: number | string | null; avg_los: number | string | null };
  type RtMonth = { period_yyyymm: string; room_type_name: string | null; room_nights: number | string | null; room_revenue: number | string | null };

  const a30 = aggregateDaily(daily, period.capacityMode);
  // Operating snapshot (period totals from mv_kpi_daily via getKpiDaily/aggregateDaily)
  const periodRev = a30.rooms_revenue ?? 0;
  const periodSold = a30.rooms_sold ?? 0;
  const periodAvail = a30.available_roomnights ?? 0;
  const periodOccPct = (a30.available_roomnights ?? 0) > 0 ? ((a30.rooms_sold ?? 0) / (a30.available_roomnights ?? 0)) * 100 : 0;
  const periodAdr = periodSold > 0 ? periodRev / periodSold : 0;
  const periodRevpar = periodAvail > 0 ? periodRev / periodAvail : 0;
  // ALOS from YTD perf view rolled up
  const rtRows = ((topRtRespYtd?.data ?? []) as RtRow[]);
  const totalBookings = rtRows.reduce((s, r) => s + Number(r.bookings ?? 0), 0);
  const totalNightsRt = rtRows.reduce((s, r) => s + Number(r.room_nights ?? 0), 0);
  const ytdAlos = totalBookings > 0 ? totalNightsRt / totalBookings : 0;

  // GL Q1 rooms revenue
  const glRevLines = ((glRevQ1?.data ?? []) as GlRevRow[]);
  const glRevQ1Total = -1 * glRevLines.reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  // GL Q1 cost lines
  const glCostLines = ((glCostQ1?.data ?? []) as GlCostRow[]);
  const cogsQ1Rooms = glCostLines.filter((r) => r.usali_subcategory === 'Cost of Sales').reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  const labourQ1Rooms = glCostLines.filter((r) => r.usali_subcategory === 'Payroll & Related').reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  const otherOeQ1 = glCostLines.filter((r) => r.usali_subcategory !== 'Cost of Sales' && r.usali_subcategory !== 'Payroll & Related').reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  const totalCostQ1 = cogsQ1Rooms + labourQ1Rooms + otherOeQ1;
  const gopQ1Rooms = glRevQ1Total - totalCostQ1;
  const gopPctQ1Rooms = glRevQ1Total > 0 ? (gopQ1Rooms / glRevQ1Total) * 100 : 0;

  // Top 5 room types YTD aggregate (multiple periods sum)
  const rtAgg = new Map<string, { rev: number; rn: number; bookings: number }>();
  for (const r of rtRows) {
    const k = r.room_type_name ?? '—';
    const cur = rtAgg.get(k) ?? { rev: 0, rn: 0, bookings: 0 };
    cur.rev += Number(r.room_revenue ?? 0);
    cur.rn  += Number(r.room_nights ?? 0);
    cur.bookings += Number(r.bookings ?? 0);
    rtAgg.set(k, cur);
  }
  const topRt = Array.from(rtAgg.entries()).sort((a, b) => b[1].rev - a[1].rev).slice(0, 6);
  const allYtdRev = Array.from(rtAgg.values()).reduce((s, v) => s + v.rev, 0);

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

  const row1: KpiTileProps[] = [
    { label: 'Rooms sold', value: fmtInt(periodSold), footnote: `${opLabel} · room-nights`, status: 'grey', size: 'sm' },
    { label: 'Occupancy %', value: fmtPct(periodOccPct), footnote: `${fmtInt(periodAvail)} avail · ${opLabel}`, status: 'grey', size: 'sm' },
    { label: 'ADR', value: fmtUsd(periodAdr), footnote: 'rev ÷ sold rn', status: 'grey', size: 'sm' },
    { label: 'RevPAR', value: fmtUsd(periodRevpar), footnote: 'rev ÷ avail rn', status: 'grey', size: 'sm' },
    { label: 'Revenue', value: fmtUsd(periodRev), footnote: `${opLabel} · PMS-booked`, status: 'grey', size: 'sm' },
    { label: 'ALOS', value: `${fmt1(ytdAlos)}n`, footnote: `YTD · ${fmtInt(totalBookings)} bookings`, status: 'grey', size: 'sm' },
  ];

  const row2: KpiTileProps[] = topRt.map(([name, v]): KpiTileProps => ({
    label: name,
    value: fmtUsd(v.rev),
    footnote: `${fmtInt(v.rn)} rn · ${allYtdRev > 0 ? ((v.rev / allYtdRev) * 100).toFixed(1) : '0'}% · ADR ${fmtUsd(v.rn > 0 ? v.rev / v.rn : 0)}`,
    status: 'grey', size: 'sm',
  }));

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/rooms') })) as DashboardTab[];

  const summaryStyle: React.CSSProperties = {
    cursor: 'pointer', padding: '10px 14px', fontSize: 12, fontWeight: 600,
    color: '#000', background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 6, letterSpacing: '0.04em',
  };

  return (
    <DashboardPage
      title="Operations · Rooms"
      subtitle={`Ops manager view · live from Cloudbeds folio + QB GL · ${opLabel}`}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Operating snapshot */}
        <Container title="Operating snapshot" subtitle={`Rooms KPIs · ${opLabel}`} density="compact" action={opPills}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row1.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        {/* Top room types YTD */}
        <Container title="Top room types · YTD 2026" subtitle="canonical room types · revenue · room-nights · share · ADR">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
            {row2.length === 0
              ? <div style={{ padding: 20, color: '#8a8170', fontStyle: 'italic', fontSize: 13 }}>No YTD room-type data yet.</div>
              : row2.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        {/* Cloudbeds folio ↔ QB GL reconciliation (rooms) */}
        <Container title="Cloudbeds folio ↔ QB GL · reconciliation" subtitle="folio = rate postings (live) · GL = bookkeeper-posted (lags ~1 mo) · delta surfaces deposits not yet posted OR re-tagged JEs">
          {(() => {
            type ReconRow = { period_yyyymm: string; folio_revenue: number | string };
            const folioRows = ((reconResp?.data ?? []) as ReconRow[]);
            const folioByPeriod = Object.fromEntries(folioRows.map((r) => [r.period_yyyymm, Number(r.folio_revenue ?? 0)]));
            // GL Q1 total already aggregated above
            const q1FolioTotal = ['2026-01','2026-02','2026-03'].reduce((s, p) => s + (folioByPeriod[p] ?? 0), 0);
            const q1Delta = q1FolioTotal - glRevQ1Total;
            const q1Pct = glRevQ1Total > 0 ? (q1FolioTotal / glRevQ1Total * 100) : 0;
            const tiles: KpiTileProps[] = [
              { label: 'Folio rev · Q1', value: fmtUsd(q1FolioTotal), footnote: 'Cloudbeds rate postings', status: 'grey', size: 'sm' },
              { label: 'QB GL rev · Q1', value: fmtUsd(glRevQ1Total), footnote: 'bookkeeper-posted', status: 'grey', size: 'sm' },
              { label: 'Δ · Q1', value: `${q1Delta >= 0 ? '+' : ''}${fmtUsd(q1Delta)}`,
                footnote: q1Delta >= 0 ? 'folio over GL · unposted deposits' : 'GL over folio · re-tagged JEs',
                status: (Math.abs(q1Delta) / Math.max(glRevQ1Total, 1) < 0.05 ? 'green' : Math.abs(q1Delta) / Math.max(glRevQ1Total, 1) < 0.15 ? 'amber' : 'red') as 'green'|'amber'|'red', size: 'sm' },
              { label: 'Folio % of GL · Q1', value: `${q1Pct.toFixed(1)}%`, footnote: 'target ~100%',
                status: (q1Pct >= 95 && q1Pct <= 110 ? 'green' : q1Pct >= 85 && q1Pct <= 120 ? 'amber' : 'red') as 'green'|'amber'|'red', size: 'sm' },
            ];
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
              </div>
            );
          })()}
        </Container>

        {/* Monthly trend (revenue + costs + GOP %) */}
        <Container title="Monthly trend · revenue · costs · GOP %" subtitle="last 16 months · live from Cloudbeds folio (gl.v_dept_revenue_monthly) · QB GL fallback when folio is empty">
          <DeptTrendChart rows={pl} dept="rooms" />
        </Container>

        {/* USALI Effective view Q1 */}
        <Container title="USALI Effective view · Rooms" subtitle={Q1_LABEL}>
          {(() => {
            const tiles: KpiTileProps[] = [
              { label: 'Rooms rev · Q1', value: fmtUsd(glRevQ1Total), footnote: 'GL bookkeeper', status: 'grey', size: 'sm' },
              { label: 'COGS · Q1', value: fmtUsd(cogsQ1Rooms), footnote: `${glRevQ1Total > 0 ? ((cogsQ1Rooms / glRevQ1Total) * 100).toFixed(1) : '0'}% / rev`, status: 'grey', size: 'sm' },
              { label: 'Payroll · Q1', value: fmtUsd(labourQ1Rooms), footnote: `${glRevQ1Total > 0 ? ((labourQ1Rooms / glRevQ1Total) * 100).toFixed(1) : '0'}% / rev`, status: 'grey', size: 'sm' },
              { label: 'Other OE · Q1', value: fmtUsd(otherOeQ1), footnote: `${glRevQ1Total > 0 ? ((otherOeQ1 / glRevQ1Total) * 100).toFixed(1) : '0'}% / rev`, status: 'grey', size: 'sm' },
              { label: 'Total cost · Q1', value: fmtUsd(totalCostQ1), footnote: `${glRevQ1Total > 0 ? ((totalCostQ1 / glRevQ1Total) * 100).toFixed(1) : '0'}% / rev`, status: 'grey', size: 'sm' },
              { label: 'GOP · Q1', value: fmtUsd(gopQ1Rooms), footnote: fmtPct(gopPctQ1Rooms),
                status: (gopPctQ1Rooms >= 60 ? 'green' : gopPctQ1Rooms >= 40 ? 'amber' : 'red') as 'green'|'amber'|'red', size: 'sm' },
            ];
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
              </div>
            );
          })()}
        </Container>

        {/* Top room types · trend since Jan 26 */}
        <details>
          <summary style={summaryStyle}>Top room types · trend since Jan 26</summary>
          <div style={{ marginTop: 10 }}>
            {(() => {
              const rows = ((topRtRespMonthly?.data ?? []) as RtMonth[]);
              const byType = new Map<string, { rn: number; rev: number }>();
              for (const r of rows) {
                const k = r.room_type_name ?? '—';
                const cur = byType.get(k) ?? { rn: 0, rev: 0 };
                cur.rn += Number(r.room_nights ?? 0);
                cur.rev += Number(r.room_revenue ?? 0);
                byType.set(k, cur);
              }
              const sorted = Array.from(byType.entries()).sort((a, b) => b[1].rev - a[1].rev);
              if (sorted.length === 0) {
                return <div style={{ padding: 20, color: '#8a8170', fontStyle: 'italic', fontSize: 13 }}>No room-type data in window.</div>;
              }
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                  <thead><tr style={{ borderBottom: '1px solid #000' }}>
                    <th style={{ textAlign: 'left', padding: 6 }}>Room type</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>Room-nights</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>Revenue</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>ADR</th>
                  </tr></thead>
                  <tbody>{sorted.map((r) => (
                    <tr key={r[0]} style={{ borderBottom: '1px solid #F0F0F0' }}>
                      <td style={{ padding: 6 }}>{r[0]}</td>
                      <td style={{ padding: 6, textAlign: 'right' }}>{fmtInt(r[1].rn)}</td>
                      <td style={{ padding: 6, textAlign: 'right' }}>{fmtUsd(r[1].rev)}</td>
                      <td style={{ padding: 6, textAlign: 'right' }}>{fmtUsd(r[1].rn > 0 ? r[1].rev / r[1].rn : 0)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              );
            })()}
          </div>
        </details>

        {/* Raw rooms transactions */}
        <details>
          <summary style={summaryStyle}>All Rooms POS transactions · search &amp; reconcile
            <span style={{ fontWeight: 400, color: '#5A5A5A', marginLeft: 6 }}>({((rawTxns?.data ?? []) as Array<unknown>).length} most recent)</span>
          </summary>
          <div style={{ marginTop: 10 }}>
            <FnbRawTransactions data={(rawTxns?.data ?? []) as Parameters<typeof FnbRawTransactions>[0]['data']} pageSize={200} />
          </div>
        </details>
      </div>
    </DashboardPage>
  );
}
