// app/revenue/pickup/page.tsx
// PBS 2026-06-01 #89 — Pickup dashboard with KPI strip + 4 graphs above the matrix.
// 9 parallel reads (no DISTINCT ON, no FULL JOIN — all auto-update on reservation sync).

import Link from 'next/link';
import {
  DashboardPage, Container, Chart, KpiTile,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import PickupMatrix from '@/app/(cockpit)/_design/PickupMatrix';
import PickupActions from './_components/PickupActions';
import { getPickupMatrix } from '@/lib/data/pickup';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const PROPERTY_ID_DONNA = 1000001;

interface Props { propertyId?: number }

export default async function PickupPage({ propertyId }: Props = {}) {
  const pid  = propertyId ?? PROPERTY_ID;
  const sym  = pid === PROPERTY_ID_DONNA ? '€' : '$';
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/pickup'),
  }));

  const todayIso = new Date().toISOString().slice(0, 10);
  const today    = new Date(todayIso);
  const ytdStart = `${today.getUTCFullYear()}-01-01`;
  const monthStartIso = todayIso.slice(0, 8) + '01';

  // Parallel fan-out
  const [matrix, otbPace, pickup30d, velocity28d, paceComparison, paceByMonth, paceCurve, pickupMonthly] = await Promise.all([
    getPickupMatrix(pid).catch(() => null),
    supabase.from('v_otb_pace')
      .select('night_date, confirmed_rooms, confirmed_revenue, cancelled_rooms')
      .eq('property_id', pid)
      .gte('night_date', todayIso)
      .order('night_date')
      .then((r) => r.data ?? []),
    supabase.from('v_pickup_30d')
      .select('stay_date, otb_rooms, otb_rooms_7d_ago, otb_rooms_30d_ago')
      .eq('property_id', pid)
      .gte('stay_date', todayIso)
      .order('stay_date')
      .then((r) => r.data ?? []),
    supabase.from('v_pickup_velocity_15d30d')
      .select('day, day_pos, pickup_ota, pickup_direct, pickup_other, pickup_total, sdly_ota, sdly_direct, sdly_total, ma_7d')
      .eq('property_id', pid)
      .order('day')
      .then((r) => r.data ?? []),
    supabase.from('v_chart_pace_comparison')
      .select('stay_year_month, otb_today_rooms, otb_30d_ago_rooms, otb_stly_rooms, otb_today_revenue, otb_stly_revenue, pickup_30d_rooms, yoy_rooms_pct')
      .eq('property_id', pid)
      .gte('target_stay_date', monthStartIso)
      .order('target_stay_date')
      .then((r) => r.data ?? []),
    supabase.from('v_pace_by_ci_month')
      .select('ci_month, room_nights, revenue, ly_room_nights, ly_revenue, rn_var_pct, rev_var_pct')
      .eq('property_id', pid)
      .gte('ci_month_start', ytdStart)
      .order('ci_month_start')
      .then((r) => r.data ?? []),
    supabase.from('v_pace_curve')
      .select('day, rooms_actual, rooms_otb, rooms_stly_daily_avg, rooms_budget_daily_avg')
      .eq('property_id', pid)
      .order('day')
      .then((r) => r.data ?? []),
    supabase.from('v_pickup_monthly')
      .select('year, month, reservations, rn, rev')
      .eq('property_id', pid)
      .gte('year', today.getUTCFullYear())
      .order('year').order('month')
      .then((r) => r.data ?? []),
  ]);

  // ---- KPI strip math (raw view rows are unknown to tsc; cast then sum) ----
  type Rows = Array<Record<string, unknown>>;
  const sum  = (xs: Rows, k: string): number => xs.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const moneyFmt = (n: number) => `${sym}${Math.round(n).toLocaleString('en-US')}`;
  const intFmt   = (n: number) => Math.round(n).toLocaleString('en-US');

  // OTB rooms / revenue forward (all future nights)
  const otbRoomsFwd   = sum(otbPace as Rows, 'confirmed_rooms');
  const otbRevenueFwd = sum(otbPace as Rows, 'confirmed_revenue');

  // Pickup 7d / 30d — diff today vs N days ago, all future stays
  const pickup7dRooms  = (pickup30d as Rows).reduce((s, r) => s + (Number(r.otb_rooms ?? 0) - Number(r.otb_rooms_7d_ago ?? 0)), 0);
  const pickup30dRooms = (pickup30d as Rows).reduce((s, r) => s + (Number(r.otb_rooms ?? 0) - Number(r.otb_rooms_30d_ago ?? 0)), 0);

  // YoY rooms % — average for next 60 days from the pace_comparison view
  const next60Days     = (paceComparison as Rows).slice(0, 60);
  const yoyRoomsPct    = next60Days.length > 0
    ? next60Days.reduce((s, r) => s + (Number.isFinite(Number(r.yoy_rooms_pct)) ? Number(r.yoy_rooms_pct) : 0), 0) / next60Days.length
    : 0;

  // Velocity — today's row (day_pos = 0) for the 7d MA tile
  const todayVel       = (velocity28d as Rows).find((r) => Number(r.day_pos) === 0);
  const velMA7d        = Number(todayVel?.ma_7d ?? 0);
  const velBucket      = 'rolling 7d';

  // Current month forecast (OTB) — pickup_monthly current year+month
  const curY = today.getUTCFullYear();
  const curM = today.getUTCMonth() + 1;
  const curMonthRow = (pickupMonthly as Rows).find((r) => Number(r.year) === curY && Number(r.month) === curM);
  const curMonthRev = Number(curMonthRow?.rev ?? 0);

  const strip: KpiTileProps[] = [
    { label: 'Rooms OTB · forward',  value: intFmt(otbRoomsFwd),   size: 'sm', footnote: `${otbPace.length} nights on the books` },
    { label: 'Revenue OTB · forward', value: moneyFmt(otbRevenueFwd), size: 'sm', footnote: `${sym} all confirmed future stays` },
    { label: 'Pickup · last 7d',     value: intFmt(pickup7dRooms),  size: 'sm', footnote: 'new rooms booked across future stays · last 7 days', status: pickup7dRooms > 0 ? 'green' : 'grey' },
    { label: 'Pickup · last 30d',    value: intFmt(pickup30dRooms), size: 'sm', footnote: 'new rooms booked across future stays · last 30 days', status: pickup30dRooms > 0 ? 'green' : 'grey' },
    { label: 'YoY rooms (next 60d)', value: `${yoyRoomsPct.toFixed(1)}%`, size: 'sm', footnote: 'OTB today vs STLY · weighted by stay date', status: yoyRoomsPct >= 0 ? 'green' : 'amber' },
    { label: 'Velocity · 7d MA',     value: intFmt(velMA7d),         size: 'sm', footnote: `bookings/day · ${velBucket || '—'}` },
    { label: `${today.toLocaleString('en-US', { month: 'short' })} ${curY} · OTB`, value: moneyFmt(curMonthRev), size: 'sm', footnote: `${curMonthRow ? `${Number(curMonthRow.rn ?? 0)} RN · ${Number(curMonthRow.reservations ?? 0)} bk` : 'no rows yet'}` },
  ];

  // ---- Chart data prep ----
  // 1) Pace comparison aggregated to month
  const paceMonthMap = new Map<string, { month: string; otb_today_rooms: number; otb_30d_ago_rooms: number; otb_stly_rooms: number }>();
  (paceComparison as Rows).forEach((r) => {
    const m = String(r.stay_year_month);
    const ex = paceMonthMap.get(m) ?? { month: m, otb_today_rooms: 0, otb_30d_ago_rooms: 0, otb_stly_rooms: 0 };
    ex.otb_today_rooms   += Number(r.otb_today_rooms ?? 0);
    ex.otb_30d_ago_rooms += Number(r.otb_30d_ago_rooms ?? 0);
    ex.otb_stly_rooms    += Number(r.otb_stly_rooms ?? 0);
    paceMonthMap.set(m, ex);
  });
  const paceCompRows = Array.from(paceMonthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  // 2) Pace curve — just remap to xKey=day
  const paceCurveRows = (paceCurve as Rows).map((r) => ({
    day:       Number(r.day),
    actual:    Number(r.rooms_actual ?? 0),
    otb:       Number(r.rooms_otb ?? 0),
    stly_avg:  Number(r.rooms_stly_daily_avg ?? 0),
    budget_avg:Number(r.rooms_budget_daily_avg ?? 0),
  }));

  // 3) TY vs LY per ci_month
  const tyLyRows = (paceByMonth as Rows).map((r) => ({
    ci_month: String(r.ci_month),
    ty_rev:   Number(r.revenue ?? 0),
    ly_rev:   Number(r.ly_revenue ?? 0),
    ty_rn:    Number(r.room_nights ?? 0),
    ly_rn:    Number(r.ly_room_nights ?? 0),
  }));

  // 4) Velocity 15d back + 30d forward · signed Δ vs SDLY (TY past only) + SDLY line (all days)
  const velocityRows = (velocity28d as Rows).map((r) => {
    const tyTotal  = r.pickup_total == null ? null : Number(r.pickup_total);
    const sdlyTot  = Number(r.sdly_total ?? 0);
    const delta    = tyTotal == null ? null : tyTotal - sdlyTot;
    return {
      day:           String(r.day).slice(5),
      delta_vs_sdly: delta,
      sdly_total:    sdlyTot,
      pickup_total:  tyTotal,
      sdly_ota:      Number(r.sdly_ota ?? 0),
      sdly_direct:   Number(r.sdly_direct ?? 0),
      ma_7d:         r.ma_7d         == null ? null : Number(r.ma_7d),
    };
  });

  return (
    <DashboardPage
      title="Revenue · Pickup matrix"
      subtitle={`12-month forward pickup grid · ${matrix?.property ?? 'Property ' + pid} · capacity ${matrix?.capacity ?? '—'} rooms`}
      tabs={tabs}
      action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link
            href="/revenue/pickup-day"
            style={{
              fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
              padding: '6px 14px', borderRadius: 4,
              background: '#FFFFFF', color: '#084838',
              border: '1px solid #084838', textDecoration: 'none',
            }}
          >
            Day report →
          </Link>
          {matrix ? <PickupActions property={matrix.property} asOfDate={matrix.asOfDate} data={matrix} /> : null}
        </div>
      }
    >
      <style>{`
        @media print {
          html, body { background: #fff !important; color: #111 !important; }
          nav[role="tablist"], .no-print, .no-print * { display: none !important; }
          a { color: inherit !important; text-decoration: none !important; }
        }
      `}</style>

      {/* KPI strip — 7 tiles in one row */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: `repeat(${strip.length}, minmax(0, 1fr))`, gap: 8, marginBottom: 12 }}>
        {strip.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      {/* Row 1 — Pace comparison (full width) */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Pace comparison · OTB today vs 30d ago vs STLY"
                   subtitle="Per stay month · rooms on the books · positive trajectory = bars climbing left to right within each month">
          <Chart variant="bar" data={paceCompRows} xKey="month"
            series={[
              { key: 'otb_stly_rooms',   label: 'OTB STLY',   color: '#A0A0A0' },
              { key: 'otb_30d_ago_rooms',label: 'OTB 30d ago',color: '#8C7A4E' },
              { key: 'otb_today_rooms',  label: 'OTB today',  color: 'var(--primary, #1F3A2E)' },
            ]}
            height={200}
            empty={{ title: 'No pace-comparison data' }} />
        </Container>
      </div>

      {/* Row 2 — Pace curve buildup + TY vs LY (2-up) */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <Container title="Pace curve · current-month buildup"
                   subtitle="Daily room-night buildup · Actual + OTB vs STLY-avg vs Budget-avg">
          <Chart variant="line" data={paceCurveRows} xKey="day"
            series={[
              { key: 'actual',     label: 'Actual + OTB', color: 'var(--primary, #1F3A2E)' },
              { key: 'otb',        label: 'OTB only',     color: 'var(--terracotta, #B8542A)' },
              { key: 'stly_avg',   label: 'STLY · daily avg', color: '#8C7A4E' },
              { key: 'budget_avg', label: 'Budget · daily avg', color: '#5C9BB5' },
            ]}
            height={180}
            empty={{ title: 'No pace-curve data' }} />
        </Container>
        <Container title="TY vs LY · revenue per stay month"
                   subtitle="On-the-books revenue this year vs last year (same stay month)">
          <Chart variant="line" data={tyLyRows} xKey="ci_month"
            series={[
              { key: 'ty_rev', label: `Revenue TY (${sym})`, color: 'var(--primary, #1F3A2E)' },
              { key: 'ly_rev', label: `Revenue LY (${sym})`, color: '#A0A0A0' },
            ]}
            height={180}
            empty={{ title: 'No TY-vs-LY data' }} />
        </Container>
      </div>

      {/* Row 3 — Velocity: 15d back + 30d forward (full width slim) */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Pickup velocity · last 15d + next 30d"
                   subtitle="Bar = TY pickup − SDLY (signed · up = ahead · down = behind, past only) · line = SDLY total at same lead time (all 46 days)">
          <Chart variant="combo" data={velocityRows} xKey="day"
            series={[
              { key: 'delta_vs_sdly', label: 'Δ TY − SDLY',    color: 'var(--primary, #1F3A2E)', type: 'bar',  yAxisId: 'left' },
              { key: 'sdly_total',    label: 'SDLY total',     color: '#8E8E8E',                   type: 'line', yAxisId: 'left' },
            ]}
            height={200}
            empty={{ title: 'No velocity data' }} />
        </Container>
      </div>

      {/* Matrix (existing, last) */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="OTB · Pickup · Comparison · SDLY"
          subtitle={matrix ? `as of ${matrix.asOfDate}` : 'data fetch failed'}
          density="compact"
        >
          {matrix ? (
            <PickupMatrix data={matrix} />
          ) : (
            <div style={{ padding: 20, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
              Could not build the matrix · check server logs.
            </div>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}
