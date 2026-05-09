// app/revenue/pulse/page.tsx — RM-meaningful restructure 2026-05-09
// PBS feedback: "all this information has no meaning for a revenue manager".
// Surface re-ordered for 30-second read:
//   1) Hero (3 cols): What's open · Today · Pace gap
//   2) ONE big pace curve (full-width, 320px)
//   3) Signals KPI strip (8 tiles, moved BELOW alerts+pace)
//   4) Decisions queued (footer)
//   5) "All charts" — collapsed <details> with the legacy 6-graph grid
//
// Data layer untouched — all 11 fetchers preserved.

import KpiBox from '@/components/kpi/KpiBox';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import Brief from '@/components/page/Brief';
import ArtifactActions from '@/components/page/ArtifactActions';
import TimeframeSelector from '@/components/page/TimeframeSelector';
import CompareSelector from '@/components/page/CompareSelector';
import { REVENUE_SUBPAGES } from '../_subpages';
import { resolvePeriod } from '@/lib/period';
import { getKpiDaily, getOverviewKpis, getChannelPerf } from '@/lib/data';
import { getPulseExtendedKpis } from '@/lib/pulseExtended';
import { getPulseToday } from '@/lib/pulseToday';
import {
  getRoomTypePulse,
  getPaceCurve,
  getPickupVelocity28d,
  getDailyRevenueForRange,
  getTacticalAlertsTop,
  getDecisionsQueuedTop,
  type PaceCurveRow,
  type PickupVelocityRow,
  type DailyRevenueRow,
  type RoomTypePulseRow,
} from '@/lib/pulseData';
import { dailyRevenue90dSvg, channelMix30dSvg } from '@/lib/svgCharts';

import PulseStatusHeader from './_components/PulseStatusHeader';
import PulseGraphsGrid from './_components/PulseGraphsGrid';
import PulseAlertsPanel from './_components/PulseAlertsPanel';
import PulseTodayPanel from './_components/PulseTodayPanel';
import PulseHeroOpen from './_components/PulseHeroOpen';
import PulsePaceGap from './_components/PulsePaceGap';
import PulsePaceCurveBig from './_components/PulsePaceCurveBig';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props { searchParams: Record<string, string | string[] | undefined>; }

const OTA_RX = /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com/i;
const DIRECT_RX = /direct|website|booking engine|email|walk[- ]?in/i;
const WHOLESALE_RX = /wholesale|tour|dmc|gta|hotelbeds|expedia partner|webbeds/i;

// ─── inline SVG helpers (for the 4 charts not covered by lib/svgCharts) ────

function occByRoomSvg(rows: RoomTypePulseRow[]): string {
  if (!rows.length) return '';
  const data = rows.filter((r) => r.occupancy_pct != null && r.rooms > 0).slice(0, 8);
  if (data.length === 0) return '';
  const W = 520, H = 240;
  const padL = 110, padR = 16, padT = 12, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = 100;
  const rowH = innerH / data.length;
  const bars = data.map((r, i) => {
    const occ = Number(r.occupancy_pct ?? 0);
    const stly = Number(r.occupancy_pct_stly ?? 0);
    const w = Math.max(1, (occ / max) * innerW);
    const ws = Math.max(0, (stly / max) * innerW);
    const y = padT + i * rowH + 3;
    const fill = occ >= 70 ? '#1a2e21' : occ >= 50 ? '#a8854a' : '#7d7565';
    return `
      <text x="${padL - 6}" y="${(y + rowH / 2 + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#4a443c">${r.room_type_name}</text>
      <rect x="${padL}" y="${(y + rowH * 0.45).toFixed(1)}" width="${ws.toFixed(1)}" height="3" fill="#7d7565" opacity="0.55"><title>${r.room_type_name} · STLY ${stly.toFixed(0)}% · v_room_type_pulse</title></rect>
      <rect x="${padL}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${(rowH - 8).toFixed(1)}" fill="${fill}" opacity="0.85"><title>${r.room_type_name} · OCC ${occ.toFixed(0)}% · STLY ${stly.toFixed(0)}% · ${r.room_nights_sold}/${r.capacity_nights} RN · v_room_type_pulse</title></rect>
      <text x="${(padL + w + 4).toFixed(1)}" y="${(y + rowH / 2 + 3).toFixed(1)}" font-size="10" font-weight="600" fill="#1a1a1a">${occ.toFixed(0)}%</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:240px;">${bars}</svg>`;
}

function adrOccScatterSvg(rows: RoomTypePulseRow[]): string {
  const data = rows.filter((r) => r.adr_usd != null && r.occupancy_pct != null && r.rooms > 0);
  if (data.length === 0) return '';
  const W = 520, H = 240;
  const padL = 50, padR = 16, padT = 14, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xMax = 100;
  const yMax = Math.max(50, ...data.map((r) => Number(r.adr_usd ?? 0))) * 1.1;
  const yTicks = [0, yMax / 2, yMax].map((v) => {
    const y = padT + innerH - (v / yMax) * innerH;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#d8cca8" stroke-dasharray="2,2"/><text x="${padL - 5}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#7d7565">$${Math.round(v)}</text>`;
  }).join('');
  const xTicks = [0, 50, 100].map((v) => {
    const x = padL + (v / xMax) * innerW;
    return `<text x="${x.toFixed(1)}" y="${(padT + innerH + 14).toFixed(1)}" text-anchor="middle" font-size="9" fill="#7d7565">${v}%</text>`;
  }).join('');
  const dots = data.map((r) => {
    const x = padL + (Number(r.occupancy_pct) / xMax) * innerW;
    const y = padT + innerH - (Number(r.adr_usd) / yMax) * innerH;
    const radius = Math.max(4, Math.sqrt(Number(r.revenue_usd ?? 0)) / 6);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="#a8854a" opacity="0.7" stroke="#1a2e21" stroke-width="0.5"><title>${r.room_type_name} · OCC ${Number(r.occupancy_pct).toFixed(0)}% · ADR $${Math.round(Number(r.adr_usd))} · Rev $${Math.round(Number(r.revenue_usd ?? 0)).toLocaleString()} · ${r.rooms} rooms · v_room_type_pulse</title></circle>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:240px;">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="#7d7565"/>
    <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="#7d7565"/>
    ${yTicks}
    ${xTicks}
    ${dots}
    <text x="${(padL + innerW / 2).toFixed(1)}" y="${(H - 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="#4a443c">Occupancy %</text>
  </svg>`;
}

function pickupVelocitySvg(rows: PickupVelocityRow[]): string {
  if (!rows.length) return '';
  const W = 520, H = 240;
  const padL = 40, padR = 16, padT = 14, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(1, ...rows.map((r) => r.bookings_made), ...rows.map((r) => r.ma_7d));
  const xStep = innerW / Math.max(1, rows.length - 1);
  const barW = Math.max(2, xStep * 0.6);
  const bars = rows.map((r, i) => {
    const x = padL + i * xStep - barW / 2;
    const h = (r.bookings_made / max) * innerH;
    const y = padT + innerH - h;
    const fill = r.bucket === 'last_2_days' ? '#a8854a' : r.bucket === 'last_3_wks' ? '#1a2e21' : '#7d7565';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" opacity="0.85"><title>${r.day} · ${r.bookings_made} bookings · 7d MA ${r.ma_7d.toFixed(1)} · ${r.bucket} · v_pickup_velocity_28d</title></rect>`;
  }).join('');
  // 7-day MA line + invisible hover dots per point
  const xy = rows.map((r, i) => [padL + i * xStep, padT + innerH - (r.ma_7d / max) * innerH] as const);
  const lineStr = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const maDots = rows.map((r, i) => {
    const [cx, cy] = xy[i];
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="transparent"><title>${r.day} · 7d MA ${r.ma_7d.toFixed(1)} bookings/day · ${r.bookings_made} same-day · v_pickup_velocity_28d</title></circle>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:240px;">
    <line x1="${padL}" y1="${(padT + innerH).toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${(padT + innerH).toFixed(1)}" stroke="#7d7565"/>
    ${bars}
    <polyline points="${lineStr}" fill="none" stroke="#1a2e21" stroke-width="1.5" stroke-dasharray="3,2"><title>7d MA bookings · ${rows.length} days · max ${max} · v_pickup_velocity_28d</title></polyline>
    ${maDots}
    <text x="${padL}" y="${(padT + 10).toFixed(1)}" font-size="9" fill="#4a443c">${max} bookings/day</text>
    <text x="${padL}" y="${(H - 4).toFixed(1)}" font-size="9" fill="#7d7565">28d · daily bookings made + 7d MA</text>
  </svg>`;
}

function paceCurveMiniSvg(rows: PaceCurveRow[]): string {
  if (!rows.length) return '';
  const W = 520, H = 240;
  const padL = 40, padR = 16, padT = 14, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const all: number[] = [];
  for (const r of rows) {
    if (r.rooms_actual != null) all.push(Number(r.rooms_actual));
    if (r.rooms_otb != null) all.push(Number(r.rooms_otb));
    if (r.rooms_stly_daily_avg != null) all.push(Number(r.rooms_stly_daily_avg));
    if (r.rooms_budget_daily_avg != null) all.push(Number(r.rooms_budget_daily_avg));
  }
  const max = Math.max(1, ...all);
  const xStep = innerW / Math.max(1, rows.length - 1);
  const xy = (i: number, v: number) => `${(padL + i * xStep).toFixed(1)},${(padT + innerH - (v / max) * innerH).toFixed(1)}`;
  const series = (key: keyof PaceCurveRow) => {
    const pts: string[] = [];
    rows.forEach((r, i) => { const v = (r as any)[key]; if (v != null) pts.push(`${pts.length === 0 ? 'M' : 'L'}${xy(i, Number(v))}`); });
    return pts.join(' ');
  };
  const todayIdx = rows.findIndex((r) => r.day >= new Date().toISOString().slice(0, 10));
  const todayLine = todayIdx >= 0 ? `<line x1="${(padL + todayIdx * xStep).toFixed(1)}" y1="${padT}" x2="${(padL + todayIdx * xStep).toFixed(1)}" y2="${(padT + innerH).toFixed(1)}" stroke="#a8854a" stroke-dasharray="2,3" opacity="0.5"/>` : '';
  // Per-day invisible hit-circles for full hover.
  const hoverDots = rows.map((r, i) => {
    const cx = (padL + i * xStep).toFixed(1);
    const parts: string[] = [r.day];
    if (r.rooms_actual != null) parts.push(`actual ${Math.round(Number(r.rooms_actual))}`);
    if (r.rooms_otb != null) parts.push(`OTB ${Math.round(Number(r.rooms_otb))}`);
    if (r.rooms_stly_daily_avg != null) parts.push(`STLY ${Math.round(Number(r.rooms_stly_daily_avg))}`);
    if (r.rooms_budget_daily_avg != null) parts.push(`budget ${Math.round(Number(r.rooms_budget_daily_avg))}`);
    parts.push('v_pace_curve');
    const txt = parts.join(' · ');
    const ys: string[] = [];
    const pushY = (v: number | null | undefined) => { if (v == null) return; ys.push((padT + innerH - (Number(v) / max) * innerH).toFixed(1)); };
    pushY(r.rooms_actual); pushY(r.rooms_otb); pushY(r.rooms_stly_daily_avg); pushY(r.rooms_budget_daily_avg);
    return ys.map((cy) => `<circle cx="${cx}" cy="${cy}" r="6" fill="transparent"><title>${txt}</title></circle>`).join('');
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:240px;">
    <line x1="${padL}" y1="${(padT + innerH).toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${(padT + innerH).toFixed(1)}" stroke="#7d7565"/>
    ${todayLine}
    <path d="${series('rooms_actual')}" fill="none" stroke="#1a2e21" stroke-width="2"><title>Pace · actual occupied · ${rows.length} days · v_pace_curve</title></path>
    <path d="${series('rooms_otb')}" fill="none" stroke="#a8854a" stroke-width="1.6"><title>Pace · OTB · ${rows.length} days · v_pace_curve</title></path>
    <path d="${series('rooms_stly_daily_avg')}" fill="none" stroke="#7d7565" stroke-width="1" stroke-dasharray="3,2"><title>Pace · STLY daily avg · ${rows.length} days · v_pace_curve</title></path>
    <path d="${series('rooms_budget_daily_avg')}" fill="none" stroke="#3B5BFF" stroke-width="1" stroke-dasharray="3,2"><title>Pace · budget daily avg · ${rows.length} days · v_pace_curve</title></path>
    ${hoverDots}
    <text x="${padL}" y="${(padT + 10).toFixed(1)}" font-size="9" fill="#4a443c">${max} rooms</text>
    <text x="${padL}" y="${(H - 4).toFixed(1)}" font-size="9" fill="#7d7565">−30d → +30d · Actual / OTB / STLY / Budget</text>
  </svg>`;
}

export default async function PulsePage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  const [
    daily90,
    extended,
    channels,
    kpis,
    rangeRev,
    roomTypePulse,
    paceCurve,
    pickupVel,
    alerts,
    decisions,
    today,
  ] = await Promise.all([
    getKpiDaily(period.from, period.to).catch(() => [] as any[]),
    getPulseExtendedKpis(period),
    getChannelPerf().catch(() => [] as any[]),
    getOverviewKpis(period).catch(() => ({ current: null, compare: null } as any)),
    getDailyRevenueForRange(period.from, period.to).catch(() => [] as DailyRevenueRow[]),
    getRoomTypePulse(period.days).catch(() => [] as RoomTypePulseRow[]),
    getPaceCurve(30, 30).catch(() => [] as PaceCurveRow[]),
    getPickupVelocity28d().catch(() => [] as PickupVelocityRow[]),
    getTacticalAlertsTop().catch(() => []),
    getDecisionsQueuedTop().catch(() => []),
    getPulseToday().catch(() => ({ booked: [], cancelled: [], bookedRevenue: 0, cancelledRevenue: 0 })),
  ]);

  const cur = kpis.current;
  const cmp = kpis.compare; // null when cmp=none/budget or data layer didn't return compare row
  const occ = Number(cur?.occupancy_pct ?? 0);
  const adr = Number(cur?.adr_usd ?? 0);
  const revpar = Number(cur?.revpar_usd ?? 0);
  const trevpar = Number(cur?.trevpar_usd ?? 0);

  // PBS 2026-05-09: compare deltas wired to KpiBox `compare` prop. Tone/colour
  // is derived inside fmtDelta — positive delta on OCC/ADR/RevPAR/TRevPAR is
  // green ("better"), negative is red ("worse"). Cancel% delta is inverted:
  // less cancel = better, so we flip sign before passing.
  const cmpLabel = period.cmpLabel ? period.cmpLabel.replace(/^vs\s+/i, '') : '';
  const cmpOcc      = cmp ? Number(cur?.occupancy_pct ?? 0) - Number(cmp?.occupancy_pct ?? 0) : null;
  const cmpAdr      = cmp ? Number(cur?.adr_usd        ?? 0) - Number(cmp?.adr_usd        ?? 0) : null;
  const cmpRevpar   = cmp ? Number(cur?.revpar_usd     ?? 0) - Number(cmp?.revpar_usd     ?? 0) : null;
  const cmpTrevpar  = cmp ? Number(cur?.trevpar_usd    ?? 0) - Number(cmp?.trevpar_usd    ?? 0) : null;

  // ─── Chart 1 — daily revenue (use lib helper) ───────────────────────────────
  const dailyRevPoints = (rangeRev.length > 0
    ? rangeRev.map((r) => ({ night_date: r.day, total_rev: r.revenue_actual_usd }))
    : (daily90 ?? []).map((d: any) => ({ night_date: String(d.night_date), total_rev: Number(d.rooms_revenue || 0) + Number(d.total_ancillary_revenue || 0) }))
  );
  const dailyRevSvg = dailyRevPoints.length > 0 ? dailyRevenue90dSvg(dailyRevPoints) : '';

  // ─── Chart 2 — channel mix (use lib helper) ─────────────────────────────────
  const totalChRev = channels.reduce((s: number, c: any) => s + Number(c.revenue_30d || c.revenue_90d || 0), 0);
  const groupRev = (rx: RegExp) => channels.filter((c: any) => rx.test(String(c.source_name || ''))).reduce((s: number, c: any) => s + Number(c.revenue_30d || c.revenue_90d || 0), 0);
  const direct = groupRev(DIRECT_RX);
  const ota = groupRev(OTA_RX);
  const wholesale = groupRev(WHOLESALE_RX);
  const other = Math.max(0, totalChRev - direct - ota - wholesale);
  const pct = (n: number) => (totalChRev > 0 ? (n / totalChRev) * 100 : 0);
  const slices = [
    { label: 'Direct', pct: pct(direct), color: '#1a2e21' },
    { label: 'OTA', pct: pct(ota), color: '#a8854a' },
    { label: 'Wholesale', pct: pct(wholesale), color: '#7d7565' },
    { label: 'Other', pct: pct(other), color: '#d8cca8' },
  ].filter((s) => s.pct > 0);
  const channelMixSvg = totalChRev > 0 && slices.length > 0 ? channelMix30dSvg(slices) : '';

  const charts = [
    { title: 'Daily revenue', sub: `${period.label} · USD · Cloudbeds`, svg: dailyRevSvg },
    { title: 'Channel mix', sub: 'last 30d · revenue share · Direct / OTA / Wholesale / Other', svg: channelMixSvg },
    { title: 'Occupancy by room type', sub: `${period.label} · v_room_type_pulse`, svg: occByRoomSvg(roomTypePulse) },
    { title: 'ADR × Occupancy', sub: 'bubble = revenue · per room type', svg: adrOccScatterSvg(roomTypePulse) },
    { title: 'Pickup velocity', sub: '28d · daily bookings + 7d MA', svg: pickupVelocitySvg(pickupVel) },
    { title: 'Booking pace curve', sub: '−30d → +30d · Actual / OTB / STLY / Budget', svg: paceCurveMiniSvg(paceCurve) },
  ];

  // Brief — narrative read of the pulse for this period.
  const briefSignal = `${period.label} · OCC ${occ.toFixed(0)}% · ADR $${adr.toFixed(0)} · RevPAR $${revpar.toFixed(0)} · TRevPAR $${trevpar.toFixed(0)}`;
  const briefBody = `${alerts.length} tactical alert${alerts.length === 1 ? '' : 's'} live, ${decisions.length} decision${decisions.length === 1 ? '' : 's'} queued. Cancel ${(extended.cancelPct ?? 0).toFixed(1)}% · lead time ${(extended.leadTimeDays ?? 0).toFixed(0)}d · ALOS ${(extended.alosNights ?? 0).toFixed(1)}.`;
  const good: string[] = [];
  const bad:  string[] = [];
  if (occ >= 70)        good.push(`Occupancy ${occ.toFixed(0)}% — strong base.`);
  if (occ < 50)         bad.push(`Occupancy ${occ.toFixed(0)}% — soft; check pricing & channel mix.`);
  if (adr >= 200)       good.push(`ADR $${adr.toFixed(0)} — premium pricing holding.`);
  if (revpar >= 150)    good.push(`RevPAR $${revpar.toFixed(0)} — top-line healthy.`);
  if ((extended.cancelPct ?? 0) > 10) bad.push(`Cancel rate ${(extended.cancelPct ?? 0).toFixed(1)}% — review non-refundable mix.`);
  if (alerts.length > 0)    bad.push(`${alerts.length} tactical alerts open — review below.`);
  if (decisions.length > 0) good.push(`${decisions.length} decisions queued for action.`);
  if (good.length === 0) good.push('No standout strengths flagged for this period.');
  if (bad.length === 0)  bad.push('No leakage signals flagged for this period.');

  const ctx = (kind: 'panel' | 'kpi' | 'brief' | 'table', title: string, signal?: string) => ({ kind, title, signal, dept: 'revenue' as const });

  return (
    <Page
      eyebrow="Revenue · Pulse"
      title={<>What's <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>open</em>, right now.</>}
      subPages={REVENUE_SUBPAGES}
      topRight={
        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <TimeframeSelector basePath="/revenue/pulse" active={period.win} preserve={{ cmp: period.cmp, seg: period.seg, cap: period.capacityMode }} />
          <CompareSelector  basePath="/revenue/pulse" active={period.cmp} preserve={{ win: period.win, seg: period.seg, cap: period.capacityMode }} />
        </div>
      }
      kpiTiles={[
        { k: 'OCC',    v: `${occ.toFixed(0)}%`,        d: period.label },
        { k: 'ADR',    v: `$${Math.round(adr).toLocaleString()}`,   d: period.label },
        { k: 'RevPAR', v: `$${Math.round(revpar).toLocaleString()}`, d: period.label },
        { k: 'TRevPAR',v: `$${Math.round(trevpar).toLocaleString()}`,d: period.label },
        { k: 'Cancel', v: `${(extended.cancelPct ?? 0).toFixed(1)}%`, d: 'cancellations' },
        { k: 'Lead',   v: `${Math.round(extended.leadTimeDays ?? 0)}d`, d: 'avg book→stay' },
      ]}
    >
      <Brief
        brief={{ signal: briefSignal, body: briefBody, good, bad }}
        actions={<ArtifactActions context={ctx('brief', `Pulse · ${period.label}`, briefSignal)} />}
      />

      <Panel title="Pulse status" eyebrow="evidence" actions={<ArtifactActions context={ctx('panel', 'Pulse status')} />}>
        <PulseStatusHeader
          periodLabel={period.label}
          rangeLabel={period.rangeLabel}
          cmpLabel={period.cmpLabel}
          segLabel={period.segLabel}
          win={period.win}
          days={period.days}
          alertCount={alerts.length}
          decisionCount={decisions.length}
        />
      </Panel>

      <div style={{ height: 14 }} />

      {/* ─── First fold: 3-column action hero ─────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 12,
          alignItems: 'stretch',
        }}
      >
        <Panel
          title="What's open"
          eyebrow={`${alerts.length} signal${alerts.length === 1 ? '' : 's'}`}
          actions={<ArtifactActions context={ctx('panel', `What's open · ${alerts.length} alerts`)} />}
        >
          <PulseHeroOpen alerts={alerts} />
        </Panel>

        <Panel
          title="Today"
          eyebrow={`${today.booked.length} new · ${today.cancelled.length} cancelled`}
          actions={<ArtifactActions context={ctx('panel', `Today · ${today.booked.length} bookings / ${today.cancelled.length} cancellations`)} />}
        >
          <PulseTodayPanel
            booked={today.booked}
            cancelled={today.cancelled}
            bookedRevenue={today.bookedRevenue}
            cancelledRevenue={today.cancelledRevenue}
          />
        </Panel>

        <Panel
          title="Pace gap"
          eyebrow="OTB vs STLY"
          actions={<ArtifactActions context={ctx('panel', 'Pace gap · OTB vs STLY')} />}
        >
          <PulsePaceGap paceCurve={paceCurve} adrUsd={adr} />
        </Panel>
      </div>

      <div style={{ height: 14 }} />

      {/* ─── Second fold: ONE big pace curve ───────────────────────────── */}
      <Panel
        title="Pace"
        eyebrow="single chart"
        actions={<ArtifactActions context={ctx('panel', 'Booking pace curve')} />}
      >
        <PulsePaceCurveBig rows={paceCurve} />
      </Panel>

      <div style={{ height: 14 }} />

      {/* ─── Third fold: 8-tile signals strip ──────────────────────────── */}
      <Panel
        title="Signals"
        eyebrow="kpi strip"
        actions={<ArtifactActions context={ctx('panel', 'Signals · 8 KPIs', briefSignal)} />}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiBox value={occ} unit="pct"  label="Occupancy"
            compare={cmpOcc != null ? { value: cmpOcc, unit: 'pp', period: cmpLabel } : undefined}
            tooltip={`Rooms sold ÷ rooms available × 100. Window: ${period.label}. Source: kpi_daily (Cloudbeds).`} />
          <KpiBox value={adr} unit="usd"  label="ADR"
            compare={cmpAdr != null ? { value: cmpAdr, unit: 'usd', period: cmpLabel } : undefined}
            tooltip={`Average daily rate = rooms revenue ÷ rooms sold. Window: ${period.label}. Source: kpi_daily.`} />
          <KpiBox value={revpar} unit="usd" label="RevPAR"
            compare={cmpRevpar != null ? { value: cmpRevpar, unit: 'usd', period: cmpLabel } : undefined}
            tooltip={`Revenue per available room = rooms revenue ÷ rooms available. Window: ${period.label}. Source: kpi_daily.`} />
          <KpiBox value={trevpar} unit="usd" label="TRevPAR"
            compare={cmpTrevpar != null ? { value: cmpTrevpar, unit: 'usd', period: cmpLabel } : undefined}
            tooltip={`Total revenue per available room (rooms + F&B + spa + activities). Window: ${period.label}. Source: kpi_daily.`} />
          <KpiBox value={extended.cancelPct ?? 0} unit="pct" label="Cancel %"   tooltip={`Cancelled reservations ÷ total reservations × 100. Window: ${period.label}. Watch ≤ 10%.`} />
          <KpiBox value={extended.noShowPct ?? 0} unit="pct" label="No-show %"  tooltip={`No-show reservations ÷ total reservations × 100. Window: ${period.label}.`} />
          <KpiBox value={extended.leadTimeDays ?? 0} unit="nights" dp={0} label="Lead time (d)" tooltip="Mean days from booking to arrival in this window." />
          <KpiBox value={extended.alosNights ?? 0} unit="nights" dp={1} label="ALOS"            tooltip="Average length of stay (room-nights ÷ stays) in this window." />
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      {/* ─── Footer: decisions queued ──────────────────────────────────── */}
      <Panel title="Decisions queued" eyebrow="actionable" actions={<ArtifactActions context={ctx('panel', 'Decisions queued')} />}>
        <PulseAlertsPanel alerts={alerts} decisions={decisions} />
      </Panel>

      <div style={{ height: 14 }} />

      {/* ─── All charts (collapsed by default) ─────────────────────────── */}
      <details style={detailsStyle}>
        <summary style={summaryStyle}>All charts <span style={summaryHint}>· daily rev · channel mix · OCC by RT · ADR×OCC · pickup · pace mini</span></summary>
        <div style={{ marginTop: 12 }}>
          <PulseGraphsGrid charts={charts} />
        </div>
      </details>
    </Page>
  );
}

const detailsStyle: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '10px 16px',
};
const summaryStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: 'var(--brass)',
};
const summaryHint: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)',
  color: 'var(--ink-mute)',
  textTransform: 'uppercase',
  fontWeight: 400,
};
