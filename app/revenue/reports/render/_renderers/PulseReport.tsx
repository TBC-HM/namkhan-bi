// app/revenue/reports/render/_renderers/PulseReport.tsx
// PBS 2026-07-03 redesign · manager-eye Pulse report.
// Sections (top → bottom):
//   1. ReportBrief — one-line signal + Good / Watch bullets
//   2. Today snapshot — in-house · arrivals · departures · new bookings 24h · cancels 24h
//   3. Month-to-date — Occ · ADR · RevPAR · Rooms rev · Total rev · all with SDLY delta
//   4. Forward 30 days — OTB rooms · OTB revenue · OTB Occ · sold-out risk · low-occ opportunities
//   5. Recent activity — new bookings 24h table (Source · Room · Rate · Value)
//   6. Top channels MTD — source · bookings · revenue · share
//   7. Live tactical alerts — from v_tactical_alerts_top
//
// Data source rules:
//   • Uses `v_reservations_unified` (public bridge) instead of pms.* — PostgREST
//     exposes ONLY public schema (claude_md §0.5).
//   • KPI baseline from v_kpi_daily (rooms_available now correctly = capacity_selling,
//     24 pre-2026-07-01, 30 after — fix landed 2026-07-02).
//   • SDLY compare = same calendar days one year back, is_actual only.

import { Container, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
import ReportBrief from './_shared/ReportBrief';
import { getTacticalAlertsTop } from '@/lib/pulseData';
import { supabase } from '@/lib/supabase';
import type { ResolvedPeriod } from '@/lib/period';

interface Props { period: ResolvedPeriod; propertyId?: number }

const NAMKHAN = 260955;

interface KpiRow { metric_date: string; rooms_available: number; rooms_sold: number; rooms_revenue: number; total_revenue: number; is_actual: boolean }
interface OtbRow { night_date: string; confirmed_rooms: number; confirmed_revenue: number }
interface ResRow { reservation_id: string; source_name: string | null; room_type_name: string | null; rate_plan: string | null; nights: number | null; total_amount: number | null; booking_date: string | null; cancellation_date: string | null; check_in_date: string | null }
interface ChanRow { source_name: string | null; total_amount: number | null }

function isoBack(days: number): string { return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10); }
function isoFwd(days: number): string  { return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10); }
function shiftYear(iso: string, dy: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + dy);
  return d.toISOString().slice(0, 10);
}
function fmt$(n: number): string { return `$${Math.round(n).toLocaleString('en-US')}`; }
function pctDelta(now: number, prior: number): { value: number; direction: 'up' | 'down' | 'flat' } {
  if (prior <= 0) return { value: 0, direction: 'flat' };
  const pct = ((now - prior) / prior) * 100;
  return { value: Math.round(pct * 10) / 10, direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' };
}
function ppDelta(now: number, prior: number): { value: number; direction: 'up' | 'down' | 'flat' } {
  const d = Math.round((now - prior) * 10) / 10;
  return { value: d, direction: d > 0.5 ? 'up' : d < -0.5 ? 'down' : 'flat' };
}
function aggKpi(rows: KpiRow[]) {
  const avail = rows.reduce((s, r) => s + Number(r.rooms_available ?? 0), 0);
  const sold  = rows.reduce((s, r) => s + Number(r.rooms_sold ?? 0), 0);
  const rev   = rows.reduce((s, r) => s + Number(r.rooms_revenue ?? 0), 0);
  const total = rows.reduce((s, r) => s + Number(r.total_revenue ?? 0), 0);
  return {
    occ:    avail > 0 ? (sold / avail) * 100 : 0,
    adr:    sold > 0 ? rev / sold : 0,
    revpar: avail > 0 ? rev / avail : 0,
    rev, total, sold, avail,
  };
}

export default async function PulseReport({ period, propertyId }: Props) {
  const pid = propertyId ?? NAMKHAN;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const sdlyToday = shiftYear(today, -1);
  const sdlyMonthStart = shiftYear(monthStart, -1);
  const in30 = isoFwd(30);
  const yst = isoBack(1);
  const kpiSelect = 'metric_date,rooms_available,rooms_sold,rooms_revenue,total_revenue,is_actual';

  const [
    todayKpi, mtdKpi, sdlyMtdKpi, otbPace,
    newBookings, cancels24,
    arrivalsTodayCount, departuresTodayCount, inHouseCount,
    channelsAll, alerts,
  ] = await Promise.all([
    supabase.from('v_kpi_daily').select(kpiSelect).eq('metric_date', today).then(r => (r.data ?? []) as KpiRow[]).catch(() => [] as KpiRow[]),
    supabase.from('v_kpi_daily').select(kpiSelect).gte('metric_date', monthStart).lte('metric_date', today).eq('is_actual', true).then(r => (r.data ?? []) as KpiRow[]).catch(() => [] as KpiRow[]),
    supabase.from('v_kpi_daily').select(kpiSelect).gte('metric_date', sdlyMonthStart).lte('metric_date', sdlyToday).eq('is_actual', true).then(r => (r.data ?? []) as KpiRow[]).catch(() => [] as KpiRow[]),
    supabase.from('v_otb_pace').select('night_date,confirmed_rooms,confirmed_revenue').eq('property_id', pid).gte('night_date', today).lte('night_date', in30).order('night_date').then(r => (r.data ?? []) as OtbRow[]).catch(() => [] as OtbRow[]),
    supabase.from('v_reservations_unified').select('reservation_id,source_name,room_type_name,rate_plan,nights,total_amount,booking_date,check_in_date,cancellation_date').eq('property_id', pid).eq('is_cancelled', false).gte('booking_date', yst).order('booking_date', { ascending: false }).limit(10).then(r => (r.data ?? []) as ResRow[]).catch(() => [] as ResRow[]),
    supabase.from('v_reservations_unified').select('reservation_id,source_name,room_type_name,rate_plan,nights,total_amount,booking_date,cancellation_date,check_in_date').eq('property_id', pid).eq('is_cancelled', true).gte('cancellation_date', yst).order('cancellation_date', { ascending: false }).limit(10).then(r => (r.data ?? []) as ResRow[]).catch(() => [] as ResRow[]),
    supabase.from('v_reservations_unified').select('reservation_id', { count: 'exact', head: true }).eq('property_id', pid).eq('is_cancelled', false).eq('check_in_date', today).then(r => r.count ?? 0).catch(() => 0),
    supabase.from('v_reservations_unified').select('reservation_id', { count: 'exact', head: true }).eq('property_id', pid).eq('is_cancelled', false).eq('check_out_date', today).then(r => r.count ?? 0).catch(() => 0),
    supabase.from('v_reservations_unified').select('reservation_id', { count: 'exact', head: true }).eq('property_id', pid).eq('is_cancelled', false).lte('check_in_date', today).gt('check_out_date', today).then(r => r.count ?? 0).catch(() => 0),
    supabase.from('v_reservations_unified').select('source_name,total_amount').eq('property_id', pid).eq('is_cancelled', false).gte('check_in_date', monthStart).lte('check_in_date', today).then(r => (r.data ?? []) as ChanRow[]).catch(() => [] as ChanRow[]),
    getTacticalAlertsTop().catch(() => [] as Array<Record<string, unknown>>),
  ]);

  // ─── Today ────────────────────────────────────────────────────────────
  const todayRow = todayKpi[0];
  const capToday = Number(todayRow?.rooms_available ?? 30);
  const soldToday = Number(todayRow?.rooms_sold ?? inHouseCount);
  const occToday = capToday > 0 ? (soldToday / capToday) * 100 : 0;
  const newBookingsCount = newBookings.length;
  const newBookingsValue = newBookings.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const cancelsCount = cancels24.length;
  const cancelsValue = cancels24.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  // ─── MTD ──────────────────────────────────────────────────────────────
  const mtd  = aggKpi(mtdKpi);
  const sdly = aggKpi(sdlyMtdKpi);
  const dOcc    = ppDelta(mtd.occ,    sdly.occ);
  const dAdr    = pctDelta(mtd.adr,    sdly.adr);
  const dRevpar = pctDelta(mtd.revpar, sdly.revpar);
  const dRooms  = pctDelta(mtd.rev,    sdly.rev);
  const dTotal  = pctDelta(mtd.total,  sdly.total);

  // ─── Forward 30 days ─────────────────────────────────────────────────
  const otbRooms30 = otbPace.reduce((s, r) => s + Number(r.confirmed_rooms ?? 0), 0);
  const otbRev30   = otbPace.reduce((s, r) => s + Number(r.confirmed_revenue ?? 0), 0);
  const cap30      = capToday * Math.max(otbPace.length, 30);
  const otbOcc30   = cap30 > 0 ? (otbRooms30 / cap30) * 100 : 0;
  const soldOutDays = otbPace.filter((r) => capToday > 0 && Number(r.confirmed_rooms ?? 0) >= capToday);
  const lowOccDays  = otbPace.filter((r) => capToday > 0 && Number(r.confirmed_rooms ?? 0) < Math.round(capToday * 0.25));

  // ─── Top channels MTD ───────────────────────────────────────────────
  const chanMap = new Map<string, { rev: number; count: number }>();
  for (const r of channelsAll) {
    const key = r.source_name ?? 'Unknown';
    const c = chanMap.get(key) ?? { rev: 0, count: 0 };
    c.rev += Number(r.total_amount ?? 0); c.count += 1;
    chanMap.set(key, c);
  }
  const chanTotal = Array.from(chanMap.values()).reduce((s, c) => s + c.rev, 0);
  const chanRows = Array.from(chanMap.entries())
    .sort((a, b) => b[1].rev - a[1].rev)
    .slice(0, 8)
    .map(([source, v]) => ({
      source,
      bookings: v.count,
      revenue: v.rev,
      share: chanTotal > 0 ? (v.rev / chanTotal) * 100 : 0,
    }));

  // ─── ReportBrief content ────────────────────────────────────────────
  const briefSignal =
    `Today · ${inHouseCount} in-house · ${arrivalsTodayCount} arrivals · ${departuresTodayCount} departures. ` +
    `MTD Occ ${mtd.occ.toFixed(0)}% (${dOcc.value >= 0 ? '+' : ''}${dOcc.value}pp vs SDLY) · ADR ${fmt$(mtd.adr)} (${dAdr.value >= 0 ? '+' : ''}${dAdr.value}%).`;
  const briefBody =
    `Next 30 days on the books: ${otbRooms30} RN · ${fmt$(otbRev30)} · projected occ ${otbOcc30.toFixed(0)}%. ` +
    `Booking pickup 24h: +${newBookingsCount} bookings (${fmt$(newBookingsValue)}) · -${cancelsCount} cancels.`;
  const good: string[] = [];
  const bad: string[] = [];
  if (mtd.occ    >= 60)             good.push(`MTD Occupancy ${mtd.occ.toFixed(0)}% — strong base.`);
  if (dAdr.value >= 5)               good.push(`ADR up ${dAdr.value}% vs SDLY — pricing holding.`);
  if (newBookingsCount >= 5)         good.push(`${newBookingsCount} bookings in the last 24h — pipeline flowing.`);
  if (soldOutDays.length > 0)        good.push(`${soldOutDays.length} sold-out day${soldOutDays.length === 1 ? '' : 's'} in next 30d — protect rates.`);
  if (mtd.occ    < 30)               bad.push(`MTD Occupancy ${mtd.occ.toFixed(0)}% — soft; review pricing / channel mix.`);
  if (dAdr.value < -5)               bad.push(`ADR down ${dAdr.value}% vs SDLY — check parity + discount depth.`);
  if (cancelsCount > newBookingsCount) bad.push(`Net negative pickup 24h: -${cancelsCount} cancels vs +${newBookingsCount} new.`);
  if (lowOccDays.length >= 5)        bad.push(`${lowOccDays.length} low-occ days (<25%) in next 30d — soft demand ahead.`);
  if (Number(alerts?.length ?? 0) > 0) bad.push(`${alerts.length} tactical alerts open — see panel below.`);
  if (good.length === 0) good.push('No standout strengths flagged for this period.');
  if (bad.length === 0)  bad.push('No leakage or demand signals flagged.');

  // ─── Tiles ──────────────────────────────────────────────────────────
  const todayTiles: KpiTileProps[] = [
    { label: 'In-house tonight', value: inHouseCount, size: 'sm', footnote: capToday > 0 ? `of ${capToday} rooms · ${occToday.toFixed(0)}%` : undefined },
    { label: 'Arrivals today',   value: arrivalsTodayCount, size: 'sm' },
    { label: 'Departures today', value: departuresTodayCount, size: 'sm' },
    { label: 'New bookings 24h', value: newBookingsCount, size: 'sm', footnote: newBookingsValue > 0 ? `${fmt$(newBookingsValue)} value` : undefined },
    { label: 'Cancels 24h',      value: cancelsCount, size: 'sm', footnote: cancelsValue > 0 ? `${fmt$(cancelsValue)} lost` : undefined },
  ];
  const mtdTiles: KpiTileProps[] = [
    { label: 'Occupancy',  value: `${mtd.occ.toFixed(1)}%`,   size: 'sm', delta: { value: dOcc.value,    period: `vs SDLY`, direction: dOcc.direction,    isGoodWhenUp: true }, footnote: `${mtd.sold}/${mtd.avail} RN · SDLY ${sdly.occ.toFixed(0)}%` },
    { label: 'ADR',        value: Math.round(mtd.adr),    currency: 'USD', size: 'sm', delta: { value: dAdr.value,    period: `vs SDLY`, direction: dAdr.direction,    isGoodWhenUp: true }, footnote: `SDLY ${fmt$(sdly.adr)}` },
    { label: 'RevPAR',     value: Math.round(mtd.revpar), currency: 'USD', size: 'sm', delta: { value: dRevpar.value, period: `vs SDLY`, direction: dRevpar.direction, isGoodWhenUp: true }, footnote: `SDLY ${fmt$(sdly.revpar)}` },
    { label: 'Rooms rev',  value: Math.round(mtd.rev),    currency: 'USD', size: 'sm', delta: { value: dRooms.value,  period: `vs SDLY`, direction: dRooms.direction,  isGoodWhenUp: true }, footnote: `SDLY ${fmt$(sdly.rev)}` },
    { label: 'Total rev',  value: Math.round(mtd.total),  currency: 'USD', size: 'sm', delta: { value: dTotal.value,  period: `vs SDLY`, direction: dTotal.direction,  isGoodWhenUp: true }, footnote: `SDLY ${fmt$(sdly.total)}` },
  ];
  const fwdTiles: KpiTileProps[] = [
    { label: 'OTB rooms · next 30d',   value: otbRooms30, size: 'sm', footnote: `${otbPace.length} days on the books` },
    { label: 'OTB revenue · next 30d', value: Math.round(otbRev30), currency: 'USD', size: 'sm' },
    { label: 'OTB occupancy · next 30d', value: `${otbOcc30.toFixed(1)}%`, size: 'sm', footnote: cap30 > 0 ? `${otbRooms30}/${cap30} RN capacity` : undefined },
    { label: 'Sold-out days',   value: soldOutDays.length, size: 'sm', status: soldOutDays.length > 0 ? 'green' : undefined, footnote: soldOutDays.length > 0 ? soldOutDays.slice(0, 3).map(d => d.night_date.slice(5)).join(' · ') : 'none' },
    { label: 'Low-occ days (<25%)', value: lowOccDays.length, size: 'sm', status: lowOccDays.length >= 5 ? 'red' : lowOccDays.length > 0 ? 'amber' : 'green' },
  ];

  return (
    <>
      <ReportBrief signal={briefSignal} body={briefBody} good={good} bad={bad} />

      <Container title="Today" subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {todayTiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Month-to-date" subtitle={`${monthStart} → ${today} · same days last year for compare`} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {mtdTiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Next 30 days on the books" subtitle={`${today} → ${in30}`} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {fwdTiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title={`New bookings · last 24h · ${newBookingsCount}`} subtitle={newBookingsValue > 0 ? `${fmt$(newBookingsValue)} total value` : 'no new bookings in window'} density="compact">
        {newBookings.length === 0 ? (
          <EmptyBlock>No new bookings received in the last 24 hours.</EmptyBlock>
        ) : (
          <MiniTable
            rows={newBookings}
            cols={[
              { key: 'source_name',    label: 'Source' },
              { key: 'room_type_name', label: 'Room' },
              { key: 'rate_plan',      label: 'Rate plan' },
              { key: 'check_in_date',  label: 'Check-in', fmt: (v) => v ? String(v).slice(0, 10) : '—' },
              { key: 'nights',         label: 'LOS', align: 'right' },
              { key: 'total_amount',   label: 'Value',    align: 'right', fmt: (v) => v ? fmt$(Number(v)) : '—' },
            ]}
          />
        )}
      </Container>

      <Container title={`Cancellations · last 24h · ${cancelsCount}`} subtitle={cancelsValue > 0 ? `${fmt$(cancelsValue)} value lost` : 'no cancellations in window'} density="compact">
        {cancels24.length === 0 ? (
          <EmptyBlock>No cancellations in the last 24 hours.</EmptyBlock>
        ) : (
          <MiniTable
            rows={cancels24}
            cols={[
              { key: 'source_name',       label: 'Source' },
              { key: 'room_type_name',    label: 'Room' },
              { key: 'check_in_date',     label: 'Was for', fmt: (v) => v ? String(v).slice(0, 10) : '—' },
              { key: 'cancellation_date', label: 'Cancelled', fmt: (v) => v ? String(v).slice(0, 10) : '—' },
              { key: 'total_amount',      label: 'Lost value', align: 'right', fmt: (v) => v ? fmt$(Number(v)) : '—' },
            ]}
          />
        )}
      </Container>

      <Container title={`Top channels · MTD · ${chanRows.length}`} subtitle={chanTotal > 0 ? `${fmt$(chanTotal)} total value on the books this month` : 'no bookings this month yet'} density="compact">
        {chanRows.length === 0 ? (
          <EmptyBlock>No channel bookings this month.</EmptyBlock>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
                  <th style={th}>Source</th>
                  <th style={{ ...th, textAlign: 'right' }}>Bookings</th>
                  <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
                  <th style={{ ...th, textAlign: 'right' }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {chanRows.map((c) => (
                  <tr key={c.source} style={{ borderTop: '1px solid #E6DFCC' }}>
                    <td style={tdL}>{c.source}</td>
                    <td style={tdR}>{c.bookings}</td>
                    <td style={tdR}>{fmt$(c.revenue)}</td>
                    <td style={tdR}>{c.share.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>

      <Container title={`Live tactical alerts · ${alerts.length}`} subtitle="from v_tactical_alerts_top · leakage / parity / demand signals" density="compact">
        {alerts.length === 0 ? (
          <EmptyBlock>No tactical alerts at this moment.</EmptyBlock>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink, #1B1B1B)', fontSize: 13, lineHeight: 1.7 }}>
            {(alerts as Array<Record<string, unknown>>).slice(0, 6).map((a, i) => (
              <li key={i}>{String(a.title ?? a.label ?? JSON.stringify(a).slice(0, 200))}</li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}

// ─── Local primitives ───────────────────────────────────────────────────
function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 12px', background: '#FFFFFF', border: '1px dashed #E6DFCC', borderRadius: 4, fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>
      {children}
    </div>
  );
}

interface Col { key: string; label: string; align?: 'left' | 'right'; fmt?: (v: unknown) => string }
function MiniTable({ rows, cols }: { rows: ResRow[]; cols: Col[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
            {cols.map((c) => (
              <th key={c.key} style={{ ...th, textAlign: c.align === 'right' ? 'right' : 'left' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.reservation_id} style={{ borderTop: '1px solid #E6DFCC' }}>
              {cols.map((c) => {
                const raw = (r as unknown as Record<string, unknown>)[c.key];
                const out = c.fmt ? c.fmt(raw) : (raw == null || raw === '' ? '—' : String(raw));
                return (
                  <td key={c.key} style={c.align === 'right' ? tdR : tdL}>{out}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '7px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: '#000', textAlign: 'left',
};
const tdL: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, color: 'var(--ink, #1B1B1B)',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220,
};
const tdR: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, textAlign: 'right',
  fontVariantNumeric: 'tabular-nums', color: 'var(--ink, #1B1B1B)',
};
