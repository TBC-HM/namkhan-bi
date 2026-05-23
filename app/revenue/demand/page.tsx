// app/revenue/demand/page.tsx
// 2026-05-23 (#105/#106/#107) — restructured per PBS:
//   Row 1 (3-up):  Room-nights · Revenue · Delta heat  (3 graphs on top)
//   Row 2 (full):  OTB headline KPI strip (4 tiles)
//   Row 3 (full):  Pace signals KPI strip (4 tiles)
//   Row 4 (full):  Window selector (forward horizon pills)
//   Row 5 (full):  Pace by check-in month — anchored here, starts Jan-2025
// Shared body for /revenue/demand (Namkhan) and /h/[id]/revenue/demand.
// Legacy preserved at /revenue/demand/legacy.

import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getPaceOtb } from '@/lib/data';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { PROPERTY_ID, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
const threeUp: React.CSSProperties = {
  gridColumn: '1 / -1',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
  alignItems: 'stretch',
};

interface DemandRow {
  ci_month: string;
  otb_roomnights: number;
  stly_roomnights: number;
  roomnights_delta: number;
  otb_revenue: number;
  stly_revenue: number;
  revenue_delta: number;
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Math.round(Number(n)).toLocaleString('en-US');
}
function fmtUSD(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return '$' + Math.round(Number(n)).toLocaleString('en-US');
}
function fmtSigned(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

interface Props {
  searchParams?: Record<string, string | string[] | undefined>;
  propertyId?: number;
}

export default async function DemandPage({ searchParams, propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/demand'),
  }));

  const period = resolvePeriod(searchParams ?? {});
  const [pace, losDist, bwDist, losWindow, countryLW, sdly, chanMix] = await Promise.all([
    // ↓ existing 5 (kept verbatim — only line replaced is the await header above)
    getPaceOtb(period, pid).catch(() => [] as Record<string, unknown>[]),
    supabase.from('v_chart_los_distribution').select('los_bucket, bucket_order, total_reservations, total_revenue, adr, share_pct').eq('property_id', pid).order('bucket_order'),
    supabase.from('v_chart_booking_window_distribution').select('booking_window_bucket, bucket_order, total_reservations, total_revenue, adr, share_pct').eq('property_id', pid).order('bucket_order'),
    supabase.from('v_chart_los_window_correlation').select('los_bucket, los_order, window_bucket, window_order, reservations, avg_los, total_revenue').eq('property_id', pid).order('window_order').order('los_order'),
    supabase.from('v_chart_country_los_window').select('guest_country, reservations, avg_los, avg_window_days, short_window_pct, share_pct, total_revenue').eq('property_id', pid).order('reservations', { ascending: false }).limit(20),
    supabase.from('v_chart_demand_monthly_sdly').select('ci_month, ty_adr, ly_adr, ty_avg_los, ly_avg_los, ty_revpar, ly_revpar, ty_bookings, ly_bookings').eq('property_id', pid).gte('ci_month', '2024-01').order('ci_month'),
    supabase.from('v_chart_channel_mix_monthly').select('ci_month, ota_bookings, direct_bookings, rest_bookings').eq('property_id', pid).gte('ci_month', '2024-01').order('ci_month'),
  ]);
  const allRows: DemandRow[] = (pace as Array<Record<string, unknown>>).map((r) => ({
    ci_month:         String(r.ci_month),
    otb_roomnights:   Number(r.otb_roomnights || 0),
    stly_roomnights:  Number(r.stly_roomnights || 0),
    roomnights_delta: Number(r.roomnights_delta || 0),
    otb_revenue:      Number(r.otb_revenue || 0),
    stly_revenue:     Number(r.stly_revenue || 0),
    revenue_delta:    Number(r.revenue_delta || 0),
  }));

  // #106: Pace table starts at Jan 2025. KPIs/headline use all rows in window.
  const rows = allRows;
  const paceTableRows = allRows.filter((r) => r.ci_month >= '2025-01');

  const total = rows.reduce(
    (a, r) => ({
      otb: a.otb + r.otb_roomnights, rev: a.rev + r.otb_revenue,
      stly: a.stly + r.stly_roomnights, stlyRev: a.stlyRev + r.stly_revenue,
    }),
    { otb: 0, rev: 0, stly: 0, stlyRev: 0 },
  );
  const paceDeltaRn = total.otb - total.stly;
  const paceDeltaRnPct = total.stly ? (paceDeltaRn / total.stly) * 100 : 0;
  const revDelta = total.rev - total.stlyRev;
  const revDeltaPct = total.stlyRev ? (revDelta / total.stlyRev) * 100 : 0;
  const monthsAhead  = rows.filter((r) => r.roomnights_delta > 0).length;
  const monthsBehind = rows.filter((r) => r.roomnights_delta < 0).length;
  const worst = rows.length > 0 ? [...rows].sort((a, b) => a.roomnights_delta - b.roomnights_delta)[0] : null;
  const best  = rows.length > 0 ? [...rows].sort((a, b) => b.roomnights_delta - a.roomnights_delta)[0] : null;

  const tiles: KpiTileProps[] = [
    { label: 'OTB Roomnights', value: fmtInt(total.otb), size: 'sm',
      delta: total.stly > 0 ? { value: paceDeltaRnPct, period: 'STLY',
        direction: paceDeltaRn >= 0 ? 'up' : 'down' } : undefined,
      footnote: `forward · ${period.label}`,
      status: paceDeltaRn >= 0 ? 'green' : 'red' },
    { label: 'OTB Revenue', value: Math.round(total.rev), currency: 'USD', size: 'sm',
      delta: total.stlyRev > 0 ? { value: revDeltaPct, period: 'STLY',
        direction: revDelta >= 0 ? 'up' : 'down' } : undefined,
      footnote: `forward · ${period.label}`,
      status: revDelta >= 0 ? 'green' : 'red' },
    { label: 'Pace Δ · RN', value: fmtSigned(paceDeltaRn), size: 'sm',
      footnote: 'room-nights vs STLY · absolute',
      status: paceDeltaRn >= 0 ? 'green' : 'red' },
    { label: 'Pace Δ · Rev', value: fmtSigned(revDelta) + ' $', size: 'sm',
      footnote: 'revenue vs STLY · absolute',
      status: revDelta >= 0 ? 'green' : 'red' },
  ];
  const signals: KpiTileProps[] = [
    { label: 'Months ahead of pace', value: monthsAhead, size: 'sm', footnote: 'Δ RN > 0', status: monthsAhead > 0 ? 'green' : 'grey' },
    { label: 'Months behind', value: monthsBehind, size: 'sm', footnote: 'Δ RN < 0', status: monthsBehind === 0 ? 'green' : 'amber' },
    { label: 'Strongest month', value: best ? best.ci_month : '—', size: 'sm',
      footnote: best ? `${fmtSigned(best.roomnights_delta)} RN vs STLY` : 'no data',
      status: best ? 'green' : 'grey' },
    { label: 'Softest month', value: worst ? worst.ci_month : '—', size: 'sm',
      footnote: worst ? `${fmtSigned(worst.roomnights_delta)} RN vs STLY` : 'no data',
      status: worst ? (worst.roomnights_delta < 0 ? 'amber' : 'green') : 'grey' },
  ];

  const trendData = rows.map((r) => ({ ci_month: r.ci_month, otb_rn: r.otb_roomnights, stly_rn: r.stly_roomnights }));
  const revData = rows.map((r) => ({ ci_month: r.ci_month, otb_rev: Math.round(r.otb_revenue), stly_rev: Math.round(r.stly_revenue) }));
  const deltaData = rows.map((r) => ({ ci_month: r.ci_month, rn_delta: r.roomnights_delta }));
  const trendSeries: ChartSeries[] = [
    { key: 'otb_rn',  label: 'OTB room-nights', color: '#1F3A2E' },
    { key: 'stly_rn', label: 'STLY room-nights', color: '#5A5A5A' },
  ];
  const revSeries: ChartSeries[] = [
    { key: 'otb_rev',  label: 'OTB revenue', color: '#1F3A2E' },
    { key: 'stly_rev', label: 'STLY revenue', color: '#B8542A' },
  ];

  const tableRows = paceTableRows.map((r) => ({
    ci_month:  r.ci_month,
    otb_rn:    fmtInt(r.otb_roomnights),
    stly_rn:   fmtInt(r.stly_roomnights),
    rn_delta:  fmtSigned(r.roomnights_delta),
    otb_rev:   fmtUSD(r.otb_revenue),
    stly_rev:  fmtUSD(r.stly_revenue),
    rev_delta: fmtSigned(r.revenue_delta) + ' $',
  }));
  const tableCols: ChartSeries[] = [
    { key: 'otb_rn',    label: 'OTB RN' },
    { key: 'stly_rn',   label: 'STLY RN' },
    { key: 'rn_delta',  label: 'Δ RN' },
    { key: 'otb_rev',   label: 'OTB Rev' },
    { key: 'stly_rev',  label: 'STLY Rev' },
    { key: 'rev_delta', label: 'Δ Rev' },
  ];

  const basePath = pid !== PROPERTY_ID ? `/h/${pid}/revenue/demand` : '/revenue/demand';
  const winOptions: Array<{ k: WindowKey; label: string }> = [
    { k: 'next7', label: '+7d' }, { k: 'next30', label: '+30d' },
    { k: 'next90', label: '+90d' }, { k: 'next180', label: '+180d' }, { k: 'next365', label: '+365d' },
  ];
  const hrefFor = (newWin: WindowKey) => {
    const p = new URLSearchParams();
    if (newWin !== 'next90') p.set('win', newWin);
    if (period.cmp && period.cmp !== 'none') p.set('cmp', period.cmp);
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };

  return (
    <DashboardPage
      title="Revenue · Demand"
      subtitle={`Find the gap before the calendar gets soft · ${period.label} · ${rows.length} month${rows.length === 1 ? '' : 's'} on the books`}
      tabs={tabs}
    >
      {/* note#155: Window selector promoted to row 1 (just under sticky header) — changes the whole page, must stay near top */}
      <div style={fullRow}>
        <Container title="Window" subtitle="forward demand horizon · stays on top of every scroll" density="compact">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {winOptions.map((o) => {
              const active = o.k === period.win;
              return (
                <a key={o.k} href={hrefFor(o.k)} style={{
                  fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '4px 10px', borderRadius: 99,
                  border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
                  background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
                  color: active ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
                  fontWeight: active ? 600 : 500, textDecoration: 'none',
                }}>{o.label}</a>
              );
            })}
          </div>
        </Container>
      </div>

      {/* Row 2 · 3 graphs on top (3-up, equal size) */}
      <div style={threeUp}>
        <Container title="Room-nights · OTB vs STLY" subtitle="by check-in month">
          <Chart variant="line" data={trendData} xKey="ci_month" series={trendSeries} height={220}
            empty={{ title: 'No demand rows', hint: 'mv_pace_otb returned 0 rows' }} />
        </Container>
        <Container title="Revenue · OTB vs STLY" subtitle="by check-in month · USD">
          <Chart variant="line" data={revData} xKey="ci_month" series={revSeries} height={220}
            empty={{ title: 'No revenue rows' }} />
        </Container>
        <Container title="Delta heat · room-nights" subtitle="positive = ahead of STLY">
          <Chart variant="bar" data={deltaData} xKey="ci_month"
            series={[{ key: 'rn_delta', label: 'Δ RN vs STLY', color: '#1F3A2E' }]}
            height={220} empty={{ title: 'No delta rows' }} />
        </Container>
      </div>

      {/* Row 2 · OTB headline KPI strip */}
      <div style={fullRow}>
        <Container title="OTB headline" subtitle={`forward window · ${period.label}`} density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      {/* Row 3 · Pace signals KPI strip */}
      <div style={fullRow}>
        <Container title="Pace signals" subtitle="month-level distribution" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {signals.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      {/* Row 4 · Pace by check-in month — moved under KPIs (#107); positive variance green, negative red (#106) */}
      <div style={fullRow}>
        <Container title={`Pace by check-in month · from Jan 2025 · ${paceTableRows.length} month${paceTableRows.length === 1 ? '' : 's'}`} subtitle="past = actual OTB · future = pace · green = ahead STLY · red = behind">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left',  padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>Check-in month</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>OTB RN</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>STLY RN</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>Δ RN</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>OTB Rev</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>STLY Rev</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>Δ Rev</th>
                </tr>
              </thead>
              <tbody>
                {paceTableRows.map((r) => (
                  <tr key={r.ci_month}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)' }}>{r.ci_month}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.otb_roomnights)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.stly_roomnights)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)', fontVariantNumeric: 'tabular-nums', color: r.roomnights_delta > 0 ? '#1F7A4B' : r.roomnights_delta < 0 ? '#B22222' : 'var(--ink-soft, #5A5A5A)', fontWeight: 600 }}>{fmtSigned(r.roomnights_delta)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)', fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(r.otb_revenue)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)', fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(r.stly_revenue)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)', fontVariantNumeric: 'tabular-nums', color: r.revenue_delta > 0 ? '#1F7A4B' : r.revenue_delta < 0 ? '#B22222' : 'var(--ink-soft, #5A5A5A)', fontWeight: 600 }}>{fmtSigned(r.revenue_delta) + ' $'}</td>
                  </tr>
                ))}
                {paceTableRows.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: 'var(--ink-soft, #5A5A5A)' }}>No pace rows from 2025-01 onwards</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Container>
      </div>



      {/* Row 5 · LOS + Booking window distributions (2-up) */}
      <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, alignItems: 'stretch' }}>
        <Container title="LOS bucket distribution" subtitle="reservations by length-of-stay bucket">
          <Chart variant="bar" data={(losDist.data ?? []).map((r) => ({
            bucket: String((r as Record<string, unknown>).los_bucket ?? ''),
            reservations: Number((r as Record<string, unknown>).total_reservations ?? 0),
            share_pct: Number((r as Record<string, unknown>).share_pct ?? 0),
          }))} xKey="bucket"
            series={[{ key: 'reservations', label: 'Reservations', color: '#1F3A2E' }]}
            height={220} empty={{ title: 'No LOS distribution data' }} />
        </Container>
        <Container title="Booking window distribution" subtitle="reservations by lead-time bucket">
          <Chart variant="bar" data={(bwDist.data ?? []).map((r) => ({
            bucket: String((r as Record<string, unknown>).booking_window_bucket ?? ''),
            reservations: Number((r as Record<string, unknown>).total_reservations ?? 0),
            share_pct: Number((r as Record<string, unknown>).share_pct ?? 0),
          }))} xKey="bucket"
            series={[{ key: 'reservations', label: 'Reservations', color: '#B8542A' }]}
            height={220} empty={{ title: 'No booking window data' }} />
        </Container>
      </div>

      {/* Row 6 · LOS × Booking-window correlation — note#153 heatmap variant */}
      <div style={fullRow}>
        <Container title="LOS × Booking-window correlation" subtitle="x = LOS bucket · y = booking-window bucket · cell intensity = reservation count">
          <Chart variant="heatmap" data={((losWindow.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            los:    String(r.los_bucket ?? ''),
            window: String(r.window_bucket ?? ''),
            count:  Number(r.reservations ?? 0),
          }))}
            xKey="los"
            yKey="window"
            series={[{ key: 'count', label: 'Reservations' }]}
            height={300}
            empty={{ title: 'No reservations in window' }} />
        </Container>
      </div>

      {/* Row 7 · Country × LOS × Booking-window — surgical tactical table */}
      <div style={fullRow}>
        <Container title="Country × LOS × Booking-window" subtitle="who books late vs who plans · short-window % flags reactive bookers · top 20 by volume">
          <Chart variant="table" data={((countryLW.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            country:           String(r.guest_country ?? 'Unknown'),
            reservations:      Number(r.reservations ?? 0),
            avg_los:           Number(r.avg_los ?? 0).toFixed(1) + ' n',
            avg_window:        Number(r.avg_window_days ?? 0).toFixed(0) + ' d',
            short_window_pct:  Number(r.short_window_pct ?? 0).toFixed(1) + '%',
            share_pct:         Number(r.share_pct ?? 0).toFixed(1) + '%',
          }))}
            xKey="country"
            series={[
              { key: 'reservations',     label: 'Bookings' },
              { key: 'avg_los',          label: 'Avg LOS' },
              { key: 'avg_window',       label: 'Avg window' },
              { key: 'short_window_pct', label: '≤7d %' },
              { key: 'share_pct',        label: 'Share' },
            ]}
            empty={{ title: 'No country reservations data' }} />
        </Container>
      </div>

      {/* Row 8 · SDLY trends (3-up): ADR · LOS · RevPAR */}
      <div style={threeUp}>
        <Container title="ADR · TY vs LY" subtitle="monthly · by check-in month">
          <Chart variant="line" data={((sdly.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            ci_month: String(r.ci_month),
            ty_adr:   Number(r.ty_adr ?? 0),
            ly_adr:   Number(r.ly_adr ?? 0),
          }))} xKey="ci_month"
            series={[
              { key: 'ty_adr', label: 'TY ADR', color: '#1F3A2E' },
              { key: 'ly_adr', label: 'LY ADR', color: '#5A5A5A' },
            ]}
            height={200} empty={{ title: 'No ADR data' }} />
        </Container>
        <Container title="LOS · TY vs LY" subtitle="avg length-of-stay by month">
          <Chart variant="line" data={((sdly.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            ci_month: String(r.ci_month),
            ty_los:   Number(r.ty_avg_los ?? 0),
            ly_los:   Number(r.ly_avg_los ?? 0),
          }))} xKey="ci_month"
            series={[
              { key: 'ty_los', label: 'TY LOS', color: '#1F3A2E' },
              { key: 'ly_los', label: 'LY LOS', color: '#5A5A5A' },
            ]}
            height={200} empty={{ title: 'No LOS data' }} />
        </Container>
        <Container title="RevPAR · TY vs LY" subtitle="monthly · rooms-revenue / room-capacity">
          <Chart variant="line" data={((sdly.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            ci_month: String(r.ci_month),
            ty_revpar: Number(r.ty_revpar ?? 0),
            ly_revpar: Number(r.ly_revpar ?? 0),
          }))} xKey="ci_month"
            series={[
              { key: 'ty_revpar', label: 'TY RevPAR', color: '#1F3A2E' },
              { key: 'ly_revpar', label: 'LY RevPAR', color: '#B8542A' },
            ]}
            height={200} empty={{ title: 'No RevPAR data' }} />
        </Container>
      </div>

      {/* Row 9 · Channel mix monthly trend (full row) */}
      <div style={fullRow}>
        <Container title="Channel mix · monthly trend" subtitle="OTAs · Direct · Rest (rest = wholesale/group/other)">
          <Chart variant="line" data={((chanMix.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            ci_month: String(r.ci_month),
            ota:      Number(r.ota_bookings ?? 0),
            direct:   Number(r.direct_bookings ?? 0),
            rest:     Number(r.rest_bookings ?? 0),
          }))} xKey="ci_month"
            series={[
              { key: 'ota',    label: 'OTAs',   color: '#1F3A2E' },
              { key: 'direct', label: 'Direct', color: '#B8542A' },
              { key: 'rest',   label: 'Rest',   color: '#B8A878' },
            ]}
            height={240} empty={{ title: 'No channel mix data' }} />
        </Container>
      </div>

    </DashboardPage>
  );
}
