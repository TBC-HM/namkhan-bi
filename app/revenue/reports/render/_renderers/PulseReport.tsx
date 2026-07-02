// app/revenue/reports/render/_renderers/PulseReport.tsx
// PBS 2026-07-03 v3 · manager-eye compact redesign.
// Now honors URL params: `period.win` drives the MAIN KPI strip; `period.cmp`
// drives the delta compare (SDLY/STLY/LW/LM/Budget). Today snapshot and
// Next-30d pipeline are fixed "now" panels.
//
// Layout:
//   • Signal bar (one line)
//   • KPI strip · <chosen period> — 5 tiles with vs-<cmp> delta
//   • KPI strip · Today
//   • KPI strip · Next 30 days on the books
//   • 2-col row · +Bookings 24h | −Cancellations 24h
//   • Top channels (chosen period)
//   • Live tactical alerts

import { Container, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
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
  const in30 = isoFwd(30);
  const yst = isoBack(1);
  const kpiSelect = 'metric_date,rooms_available,rooms_sold,rooms_revenue,total_revenue,is_actual';
  const cmpActive = period.compareFrom && period.compareTo;
  const cmpLabelShort = (period.cmpLabel ?? '').replace(/^vs\s+/i, '') || 'SDLY';

  const [
    mainKpi, cmpKpi, todayKpi, otbPace,
    newBookings, cancels24,
    arrivalsTodayCount, departuresTodayCount, inHouseCount,
    channelsPeriod, alerts,
  ] = await Promise.all([
    supabase.from('v_kpi_daily').select(kpiSelect).gte('metric_date', period.from).lte('metric_date', period.to).eq('is_actual', true).then(r => (r.data ?? []) as KpiRow[]).catch(() => [] as KpiRow[]),
    cmpActive
      ? supabase.from('v_kpi_daily').select(kpiSelect).gte('metric_date', period.compareFrom!).lte('metric_date', period.compareTo!).eq('is_actual', true).then(r => (r.data ?? []) as KpiRow[]).catch(() => [] as KpiRow[])
      : Promise.resolve([] as KpiRow[]),
    supabase.from('v_kpi_daily').select(kpiSelect).eq('metric_date', today).then(r => (r.data ?? []) as KpiRow[]).catch(() => [] as KpiRow[]),
    supabase.from('v_otb_pace').select('night_date,confirmed_rooms,confirmed_revenue').eq('property_id', pid).gte('night_date', today).lte('night_date', in30).order('night_date').then(r => (r.data ?? []) as OtbRow[]).catch(() => [] as OtbRow[]),
    supabase.from('v_reservations_unified').select('reservation_id,source_name,room_type_name,rate_plan,nights,total_amount,booking_date,check_in_date,cancellation_date').eq('property_id', pid).eq('is_cancelled', false).gte('booking_date', yst).order('booking_date', { ascending: false }).limit(15).then(r => (r.data ?? []) as ResRow[]).catch(() => [] as ResRow[]),
    supabase.from('v_reservations_unified').select('reservation_id,source_name,room_type_name,rate_plan,nights,total_amount,booking_date,cancellation_date,check_in_date').eq('property_id', pid).eq('is_cancelled', true).gte('cancellation_date', yst).order('cancellation_date', { ascending: false }).limit(15).then(r => (r.data ?? []) as ResRow[]).catch(() => [] as ResRow[]),
    supabase.from('v_reservations_unified').select('reservation_id', { count: 'exact', head: true }).eq('property_id', pid).eq('is_cancelled', false).eq('check_in_date', today).then(r => r.count ?? 0).catch(() => 0),
    supabase.from('v_reservations_unified').select('reservation_id', { count: 'exact', head: true }).eq('property_id', pid).eq('is_cancelled', false).eq('check_out_date', today).then(r => r.count ?? 0).catch(() => 0),
    supabase.from('v_reservations_unified').select('reservation_id', { count: 'exact', head: true }).eq('property_id', pid).eq('is_cancelled', false).lte('check_in_date', today).gt('check_out_date', today).then(r => r.count ?? 0).catch(() => 0),
    supabase.from('v_reservations_unified').select('source_name,total_amount').eq('property_id', pid).eq('is_cancelled', false).gte('check_in_date', period.from).lte('check_in_date', period.to).then(r => (r.data ?? []) as ChanRow[]).catch(() => [] as ChanRow[]),
    getTacticalAlertsTop().catch(() => [] as Array<Record<string, unknown>>),
  ]);

  const todayRow = todayKpi[0];
  const capToday = Number(todayRow?.rooms_available ?? 30);
  const newBookingsValue = newBookings.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const cancelsValue = cancels24.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  const main = aggKpi(mainKpi);
  const cmp  = aggKpi(cmpKpi);
  const dOcc    = cmpActive ? ppDelta(main.occ,    cmp.occ)    : { value: 0, direction: 'flat' as const };
  const dAdr    = cmpActive ? pctDelta(main.adr,    cmp.adr)    : { value: 0, direction: 'flat' as const };
  const dRevpar = cmpActive ? pctDelta(main.revpar, cmp.revpar) : { value: 0, direction: 'flat' as const };
  const dRooms  = cmpActive ? pctDelta(main.rev,    cmp.rev)    : { value: 0, direction: 'flat' as const };
  const dTotal  = cmpActive ? pctDelta(main.total,  cmp.total)  : { value: 0, direction: 'flat' as const };

  const otbRooms30 = otbPace.reduce((s, r) => s + Number(r.confirmed_rooms ?? 0), 0);
  const otbRev30   = otbPace.reduce((s, r) => s + Number(r.confirmed_revenue ?? 0), 0);
  const cap30      = capToday * Math.max(otbPace.length, 30);
  const otbOcc30   = cap30 > 0 ? (otbRooms30 / cap30) * 100 : 0;
  const soldOutDays = otbPace.filter((r) => capToday > 0 && Number(r.confirmed_rooms ?? 0) >= capToday);
  const lowOccDays  = otbPace.filter((r) => capToday > 0 && Number(r.confirmed_rooms ?? 0) < Math.round(capToday * 0.25));

  const chanMap = new Map<string, { rev: number; count: number }>();
  for (const r of channelsPeriod) {
    const key = r.source_name ?? 'Unknown';
    const c = chanMap.get(key) ?? { rev: 0, count: 0 };
    c.rev += Number(r.total_amount ?? 0); c.count += 1;
    chanMap.set(key, c);
  }
  const chanTotal = Array.from(chanMap.values()).reduce((s, c) => s + c.rev, 0);
  const chanRows = Array.from(chanMap.entries())
    .sort((a, b) => b[1].rev - a[1].rev)
    .slice(0, 8)
    .map(([source, v]) => ({ source, bookings: v.count, revenue: v.rev, share: chanTotal > 0 ? (v.rev / chanTotal) * 100 : 0 }));

  const signalTxt =
    `${inHouseCount} in-house · ${arrivalsTodayCount} arr · ${departuresTodayCount} dep today · ` +
    `${period.label} Occ ${main.occ.toFixed(0)}%${cmpActive ? ` (${dOcc.value >= 0 ? '+' : ''}${dOcc.value}pp vs ${cmpLabelShort})` : ''} · ADR ${fmt$(main.adr)}${cmpActive ? ` (${dAdr.value >= 0 ? '+' : ''}${dAdr.value}%)` : ''} · ` +
    `Fwd 30d OTB ${otbRooms30}RN / ${fmt$(otbRev30)}${soldOutDays.length ? ` · ${soldOutDays.length} sold-out` : ''}${lowOccDays.length ? ` · ${lowOccDays.length} low-occ` : ''}`;

  const mainTiles: KpiTileProps[] = [
    { label: 'Occupancy', value: `${main.occ.toFixed(1)}%`,   size: 'sm', delta: cmpActive ? { value: dOcc.value,    period: `vs ${cmpLabelShort}`, direction: dOcc.direction,    isGoodWhenUp: true } : undefined, footnote: `${main.sold}/${main.avail} RN` },
    { label: 'ADR',       value: Math.round(main.adr),    currency: 'USD', size: 'sm', delta: cmpActive ? { value: dAdr.value,    period: `vs ${cmpLabelShort}`, direction: dAdr.direction,    isGoodWhenUp: true } : undefined, footnote: cmpActive ? `${cmpLabelShort} ${fmt$(cmp.adr)}` : undefined },
    { label: 'RevPAR',    value: Math.round(main.revpar), currency: 'USD', size: 'sm', delta: cmpActive ? { value: dRevpar.value, period: `vs ${cmpLabelShort}`, direction: dRevpar.direction, isGoodWhenUp: true } : undefined, footnote: cmpActive ? `${cmpLabelShort} ${fmt$(cmp.revpar)}` : undefined },
    { label: 'Rooms rev', value: Math.round(main.rev),    currency: 'USD', size: 'sm', delta: cmpActive ? { value: dRooms.value,  period: `vs ${cmpLabelShort}`, direction: dRooms.direction,  isGoodWhenUp: true } : undefined, footnote: cmpActive ? `${cmpLabelShort} ${fmt$(cmp.rev)}` : undefined },
    { label: 'Total rev', value: Math.round(main.total),  currency: 'USD', size: 'sm', delta: cmpActive ? { value: dTotal.value,  period: `vs ${cmpLabelShort}`, direction: dTotal.direction,  isGoodWhenUp: true } : undefined, footnote: cmpActive ? `${cmpLabelShort} ${fmt$(cmp.total)}` : undefined },
  ];
  const todayTiles: KpiTileProps[] = [
    { label: 'In-house tonight', value: inHouseCount, size: 'sm', footnote: capToday > 0 ? `of ${capToday}` : undefined },
    { label: 'Arrivals',         value: arrivalsTodayCount, size: 'sm' },
    { label: 'Departures',       value: departuresTodayCount, size: 'sm' },
    { label: '+ Bookings 24h',   value: newBookings.length, size: 'sm', footnote: newBookingsValue > 0 ? fmt$(newBookingsValue) : undefined },
    { label: '− Cancels 24h',    value: cancels24.length, size: 'sm', footnote: cancelsValue > 0 ? fmt$(cancelsValue) : undefined },
  ];
  const fwdTiles: KpiTileProps[] = [
    { label: 'Rooms OTB',   value: otbRooms30, size: 'sm', footnote: `${otbPace.length}d` },
    { label: 'Revenue OTB', value: Math.round(otbRev30), currency: 'USD', size: 'sm' },
    { label: 'Occ %',       value: `${otbOcc30.toFixed(0)}%`, size: 'sm', footnote: cap30 > 0 ? `${otbRooms30}/${cap30}` : undefined },
    { label: 'Sold-out days', value: soldOutDays.length, size: 'sm', status: soldOutDays.length > 0 ? 'green' : undefined, footnote: soldOutDays.slice(0, 3).map(d => d.night_date.slice(5)).join('·') || 'none' },
    { label: 'Low-occ days', value: lowOccDays.length, size: 'sm', status: lowOccDays.length >= 5 ? 'red' : lowOccDays.length > 0 ? 'amber' : 'green', footnote: '<25% booked' },
  ];

  return (
    <>
      {/* signal bar */}
      <div style={{ gridColumn: '1 / -1', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12.5, color: '#1B1B1B', lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 10, color: '#5A5A5A', marginRight: 10 }}>Signal</span>
        {signalTxt}
      </div>

      <KpiStrip title={period.label} subtitle={cmpActive ? `vs ${cmpLabelShort} · ${period.compareFrom} → ${period.compareTo}` : period.rangeLabel} tiles={mainTiles} />
      <KpiStrip title="Today" subtitle={new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })} tiles={todayTiles} />
      <KpiStrip title="Next 30 days on the books" subtitle={`${today} → ${in30}`} tiles={fwdTiles} />

      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <Container title={`+ New bookings · 24h · ${newBookings.length}`} subtitle={newBookingsValue > 0 ? `${fmt$(newBookingsValue)} value` : 'no new bookings'} density="compact">
          {newBookings.length === 0 ? (
            <Empty>No new bookings in the last 24 hours.</Empty>
          ) : (
            <MiniTable rows={newBookings} cols={[
              { key: 'source_name',    label: 'Source' },
              { key: 'check_in_date',  label: 'CI', fmt: (v) => v ? String(v).slice(5, 10) : '—' },
              { key: 'nights',         label: 'LOS', align: 'right' },
              { key: 'total_amount',   label: 'Value', align: 'right', fmt: (v) => v ? fmt$(Number(v)) : '—' },
            ]} />
          )}
        </Container>

        <Container title={`− Cancellations · 24h · ${cancels24.length}`} subtitle={cancelsValue > 0 ? `${fmt$(cancelsValue)} lost` : 'no cancellations'} density="compact">
          {cancels24.length === 0 ? (
            <Empty>No cancellations in the last 24 hours.</Empty>
          ) : (
            <MiniTable rows={cancels24} cols={[
              { key: 'source_name',       label: 'Source' },
              { key: 'check_in_date',     label: 'Was for', fmt: (v) => v ? String(v).slice(5, 10) : '—' },
              { key: 'cancellation_date', label: 'On',      fmt: (v) => v ? String(v).slice(5, 10) : '—' },
              { key: 'total_amount',      label: 'Lost',    align: 'right', fmt: (v) => v ? fmt$(Number(v)) : '—' },
            ]} />
          )}
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Top channels · ${period.label}`} subtitle={chanTotal > 0 ? `${fmt$(chanTotal)} on the books · ${chanRows.length} sources` : 'no bookings in period'} density="compact">
          {chanRows.length === 0 ? (
            <Empty>No channel bookings in this period.</Empty>
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
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Live tactical alerts · ${alerts.length}`} subtitle="leakage · parity · demand signals" density="compact">
          {alerts.length === 0 ? (
            <Empty>No tactical alerts at this moment.</Empty>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: '#1B1B1B' }}>
              {(alerts as Array<Record<string, unknown>>).slice(0, 6).map((a, i) => (
                <li key={i}>{String(a.title ?? a.label ?? JSON.stringify(a).slice(0, 200))}</li>
              ))}
            </ul>
          )}
        </Container>
      </div>
    </>
  );
}

function KpiStrip({ title, subtitle, tiles }: { title: string; subtitle: string; tiles: KpiTileProps[] }) {
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1B1B1B' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#5A5A5A' }}>{subtitle}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 12px', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>{children}</div>
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
                return (<td key={c.key} style={c.align === 'right' ? tdR : tdL}>{out}</td>);
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { padding: '6px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#000', textAlign: 'left' };
const tdL: React.CSSProperties = { padding: '5px 10px', fontSize: 12, color: '#1B1B1B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 };
const tdR: React.CSSProperties = { padding: '5px 10px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1B1B1B' };
