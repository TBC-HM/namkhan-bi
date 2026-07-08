// app/revenue/pulse/page.tsx
// PBS 2026-07-08 layout:
//   Row 1 (full):    Headline · yesterday  (4 KPI tiles)
//   Rows 2+3 (3×2):  R2 = Pickup+Cancellations | Perf vs STLY | Top 10 sources
//                    R3 = Performance graph    | Events cal.  | Occupancy cal.
//   All 6 cells forced to identical dimensions via one grid with fixed row heights.
// Server→client function-prop trap: no functions pass through primitives —
// every table cell is pre-formatted as a string in the data array.

import {
  DashboardPage, Container, KpiTile, Chart,
  MonthCalendar, PickupTabs,
  type ChartSeries, type DashboardTab, type KpiTileProps, type CalendarDay,
} from '@/app/(cockpit)/_design';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { PROPERTY_ID } from '@/lib/supabase';
import {
  getPulseHeadlineKpis,
  getPulsePerformanceSummary,
  getPulseDaily,
  getPulseTopSources,
  getPulseHighOcc,
  getPulseTodayPickup,
  getPulseTodayCancellations,
  getPulseUpcomingEvents,
  type PulseDailyRow,
  type PulseKpiSnapshot,
  type PulseSourceRow,
  type PulseHighOccDay,
  type PulsePickupRow,
  type PulseEventRow,
} from '@/lib/data-pulse';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
  propertyId?: number;
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
// PBS 2026-07-08: all six body containers must render at EXACTLY the same size.
// One 3×2 grid with explicit row heights + stretch guarantees identical rectangles;
// per-row `threeUp` grids only equalise within a row and let heights drift row-to-row.
const sixCell: React.CSSProperties = {
  gridColumn: '1 / -1',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gridTemplateRows: 'repeat(2, minmax(380px, 1fr))',
  gap: 10,
  alignItems: 'stretch',
};
const cellFill: React.CSSProperties = { display: 'flex', flexDirection: 'column', minHeight: 0 };

function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function pctChange(now: number, prior: number | null): number | null {
  if (prior == null || prior === 0) return null;
  return ((now - prior) / prior) * 100;
}
function fmtMoney(n: number | null | undefined, sym: string = '$'): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return sym + Math.round(Number(n)).toLocaleString('en-US');
}
function fmtPct(n: number | null | undefined, decimals = 0): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toFixed(decimals)}%`;
}
function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Math.round(Number(n)).toLocaleString('en-US');
}
function fmtSignedPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.round(Math.abs(v))}%`;
}

export default async function PulsePage({ searchParams, propertyId }: Props) {
  const pid = propertyId ?? PROPERTY_ID;
  const sym: string = pid === 1000001 ? '€' : '$';
  const moneyCurrency: 'USD' | 'EUR' = pid === 1000001 ? 'EUR' : 'USD';
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const basePath = pid !== PROPERTY_ID ? `/h/${pid}/revenue/pulse` : '/revenue/pulse';

  const offsetParam = typeof searchParams.offset === 'string' ? searchParams.offset : '0';
  const winParam = typeof searchParams.win === 'string' ? searchParams.win : '30d';
  const offset = Math.max(-365, Math.min(365, parseInt(offsetParam, 10) || 0));
  const winDays = winParam === '7d' ? 7 : winParam === '14d' ? 14 : winParam === '60d' ? 60 : 30;

  const pickupOffsetParam = typeof searchParams.pickupOffset === 'string' ? searchParams.pickupOffset : '0';
  const pickupOffset = Math.max(-8, Math.min(0, parseInt(pickupOffsetParam, 10) || 0));

  const anchor = todayIso();
  const heroFrom = shiftDate(anchor, offset);
  const heroTo = shiftDate(anchor, offset + winDays - 1);
  const stlyFrom = shiftDate(heroFrom, -365);
  const stlyTo = shiftDate(heroTo, -365);

  const [headline, summary, dailyRows, stlyDailyRows, topSources, highOcc, pickup, cancellations, events] =
    await Promise.all([
      getPulseHeadlineKpis(pid, anchor),
      getPulsePerformanceSummary(pid, anchor),
      getPulseDaily(pid, heroFrom, heroTo),
      getPulseDaily(pid, stlyFrom, stlyTo),
      getPulseTopSources(pid, 30, 10),
      getPulseHighOcc(pid, anchor, shiftDate(anchor, 30), 0),
      getPulseTodayPickup(pid, shiftDate(anchor, pickupOffset)),
      getPulseTodayCancellations(pid, shiftDate(anchor, pickupOffset)),
      getPulseUpcomingEvents(pid, anchor, shiftDate(anchor, 30), 30),
    ]) as [PulseKpiSnapshot, Awaited<ReturnType<typeof getPulsePerformanceSummary>>, PulseDailyRow[], PulseDailyRow[], PulseSourceRow[], PulseHighOccDay[], PulsePickupRow[], PulsePickupRow[], PulseEventRow[]];

  // ─── headline tiles ──────────────────────────────────────────────────
  const occΔ    = pctChange(headline.occupancyPct, headline.stlyOccupancyPct);
  const revparΔ = pctChange(headline.revpar,       headline.stlyRevpar);
  const rnsΔ    = pctChange(headline.roomsSold,    headline.stlyRoomsSold);
  const adrΔ    = pctChange(headline.adr,          headline.stlyAdr);

  const headlineTiles: KpiTileProps[] = [
    // PBS 2026-07-08: read yesterday's OCC from the same mv_kpi_daily aggregate used by
    // the Performance vs STLY container, so the two boxes always report the same number.
    { label: 'Occ · yesterday', value: `${Math.round(summary.yesterday.occupancyPct ?? 0)}%`, size: 'sm',
      delta: occΔ != null ? { value: occΔ, period: 'STLY', direction: occΔ >= 0 ? 'up' : 'down' } : undefined,
      status: occΔ != null && occΔ >= 0 ? 'green' : occΔ != null ? 'red' : 'grey' },
    { label: 'RevPAR', value: Math.round(headline.revpar ?? 0), currency: moneyCurrency, size: 'sm',
      delta: revparΔ != null ? { value: revparΔ, period: 'STLY', direction: revparΔ >= 0 ? 'up' : 'down' } : undefined,
      footnote: 'yesterday', status: revparΔ != null && revparΔ >= 0 ? 'green' : revparΔ != null ? 'red' : 'grey' },
    { label: 'Room Nights Sold', value: fmtInt(headline.roomsSold), size: 'sm',
      delta: rnsΔ != null ? { value: rnsΔ, period: 'STLY', direction: rnsΔ >= 0 ? 'up' : 'down' } : undefined,
      footnote: 'yesterday', status: rnsΔ != null && rnsΔ >= 0 ? 'green' : rnsΔ != null ? 'red' : 'grey' },
    { label: 'ADR', value: Math.round(headline.adr ?? 0), currency: moneyCurrency, size: 'sm',
      delta: adrΔ != null ? { value: adrΔ, period: 'STLY', direction: adrΔ >= 0 ? 'up' : 'down' } : undefined,
      footnote: 'yesterday', status: adrΔ != null && adrΔ >= 0 ? 'green' : adrΔ != null ? 'red' : 'grey' },
  ];

  // ─── performance summary table (3 metrics × 3 windows, with STLY %) ───
  const perfTable = (['occupancyPct','revpar','adr'] as const).map((field) => {
    const label = field === 'occupancyPct' ? 'Occupancy' : field === 'revpar' ? 'RevPAR' : 'ADR';
    const unit  = field === 'occupancyPct' ? 'pct' : 'usd';
    const fmt   = (v: number | null | undefined) =>
      v == null ? '—' : unit === 'pct' ? fmtPct(v, 0) : fmtMoney(v, sym);
    const stlyField = field === 'occupancyPct' ? 'stlyOccupancyPct' : field === 'revpar' ? 'stlyRevpar' : 'stlyAdr';
    const cell = (snap: PulseKpiSnapshot) => {
      const now = Number(snap[field] ?? 0);
      const stly = snap[stlyField] as number | null;
      const Δ = stly != null && stly !== 0 ? ((now - stly) / stly) * 100 : null;
      return Δ != null ? `${fmt(now)}  ${fmtSignedPct(Δ)}` : fmt(now);
    };
    return {
      metric: label,
      yesterday: cell(summary.yesterday),
      mtd:       cell(summary.mtd),
      ytd:       cell(summary.ytd),
    };
  });

  // ─── hero chart series ────────────────────────────────────────────────
  const stlyByDate = new Map<string, PulseDailyRow>();
  for (const r of stlyDailyRows) stlyByDate.set(shiftDate(r.night_date, 365), r);
  const heroData = dailyRows.map((r) => ({
    night_date: r.night_date,
    revpar:     r.revpar,
    adr:        r.adr,
    occupancy:  r.occupancy_pct,
    stly_revpar: stlyByDate.get(r.night_date)?.revpar ?? null,
    stly_adr:    stlyByDate.get(r.night_date)?.adr    ?? null,
  }));
  const heroSeries: ChartSeries[] = [
    { key: 'revpar',      label: 'RevPAR',      color: '#1F3A2E' },
    { key: 'adr',         label: 'ADR',         color: '#B8A878' },
    { key: 'stly_revpar', label: 'STLY RevPAR', color: '#5A5A5A' },
    { key: 'stly_adr',    label: 'STLY ADR',    color: '#A89A78' },
  ];

  // ─── tabs + URL builders ──────────────────────────────────────────────
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key:    s.href,
    label:  s.label,
    href:   s.href,
    active: s.href.endsWith('/pulse'),
  }));
  const scrubHref = (newOffset: number) => {
    const p = new URLSearchParams();
    if (newOffset !== 0) p.set('offset', String(newOffset));
    if (winParam !== '30d') p.set('win', winParam);
    if (pickupOffset !== 0) p.set('pickupOffset', String(pickupOffset));
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };
  const winHref = (newWin: string) => {
    const p = new URLSearchParams();
    if (offset !== 0) p.set('offset', String(offset));
    if (newWin !== '30d') p.set('win', newWin);
    if (pickupOffset !== 0) p.set('pickupOffset', String(pickupOffset));
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };
  const pickupHref = (newPickupOffset: number) => {
    const clamped = Math.max(-8, Math.min(0, newPickupOffset));
    const p = new URLSearchParams();
    if (offset !== 0) p.set('offset', String(offset));
    if (winParam !== '30d') p.set('win', winParam);
    if (clamped !== 0) p.set('pickupOffset', String(clamped));
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };

  // ─── pickup + cancellation rows for tabs ──────────────────────────────
  const moneyStr = (n: number) => n > 0 ? `${sym}${Math.round(n).toLocaleString('en-US')}` : '—';
  const pickupTabRows = pickup.map((p: PulsePickupRow) => ({
    source: p.source, guest: p.guest, reservation_id: p.reservation_id,
    accommodation: p.accommodation, nights: p.nights,
    adr: moneyStr(p.adr), value: moneyStr(p.value), window: p.window,
  }));
  const cancelTabRows = cancellations.map((p: PulsePickupRow) => ({
    source: p.source, guest: p.guest, reservation_id: p.reservation_id,
    accommodation: p.accommodation, nights: p.nights,
    adr: moneyStr(p.adr), value: moneyStr(p.value), window: p.window,
  }));
  const pickupDate = shiftDate(anchor, pickupOffset);
  const pickupLabel = pickupOffset === 0 ? 'Today' : pickupOffset === -1 ? 'Yesterday' : `${Math.abs(pickupOffset)} days ago`;

  // ─── 30-day calendars (events + occupancy) ────────────────────────────
  const calendarDays: { date: string }[] = (() => {
    const out: { date: string }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(anchor + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      out.push({ date: d.toISOString().slice(0, 10) });
    }
    return out;
  })();
  const eventsByDay = new Map<string, string[]>();
  for (const e of events) {
    const k = String(e.date).slice(0, 10);
    const arr = eventsByDay.get(k) ?? [];
    arr.push(e.name);
    eventsByDay.set(k, arr);
  }
  const eventCalendar: CalendarDay[] = calendarDays.map((d) => {
    const evs = eventsByDay.get(d.date) ?? [];
    return {
      date: d.date,
      label: evs.length > 0 ? `${evs.length}` : undefined,
      tone: evs.length > 0 ? 'brass' : undefined,
      tooltip: evs.length > 0 ? `${d.date}\n${evs.join('\n')}` : undefined,
    };
  });
  const occByDay = new Map<string, number>();
  for (const r of highOcc as PulseHighOccDay[]) {
    occByDay.set(String((r as any).night_date ?? (r as any).date).slice(0, 10), Number(r.occupancy_pct ?? 0));
  }
  const occCalendar: CalendarDay[] = calendarDays.map((d) => {
    const pct = occByDay.get(d.date);
    if (pct == null) return { date: d.date };
    const tone: CalendarDay['tone'] = pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red';
    return {
      date: d.date,
      label: `${Math.round(pct)}%`,
      tone,
      tooltip: `${d.date}\nOccupancy: ${pct.toFixed(1)}%`,
    };
  });

  // ─── top 10 sources rows ──────────────────────────────────────────────
  const topSourceRows = topSources.map((s: PulseSourceRow) => ({
    channel:  s.source_name,
    bookings: s.bookings,
    revenue:  s.revenue != null && s.revenue > 0 ? `${sym}${Math.round(s.revenue).toLocaleString('en-US')}` : '—',
  }));

  return (
    <DashboardPage
      title="Revenue · Pulse"
      subtitle={`${fmtLongDate(anchor)} · what's open, right now`}
      tabs={tabs}
    >
      {/* Row 1 · Headline KPI strip */}
      <div style={fullRow}>
        <Container title="Headline · yesterday" subtitle="vs same time last year" density="compact">
          {/* PBS 2026-07-08: tile grid mirrors the HoD page (Vector) — 160px min / 8px gap — so the two pages read as one. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {headlineTiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      {/* Rows 2+3 · 3×2 grid — all six cells identical size.
          Row 2: Pickup+Cancellations | Performance vs STLY | Top 10 sources
          Row 3: Performance · graph  | Events calendar     | Occupancy calendar */}
      <div style={sixCell}>
        {/* R2C1 */}
        <div style={cellFill}>
          <Container title={`${pickupLabel} · pickup + cancellations`} subtitle={`activity on ${fmtLongDate(pickupDate)}`}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 12 }}>
              <PillLink href={pickupHref(pickupOffset - 1)} active={false} disabled={pickupOffset <= -8}>←</PillLink>
              <PillLink href={pickupHref(pickupOffset)} active={true}>{pickupLabel}</PillLink>
              {pickupOffset !== 0 && <PillLink href={pickupHref(0)} active={false}>↺ today</PillLink>}
              <PillLink href={pickupHref(pickupOffset + 1)} active={false} disabled={pickupOffset >= 0}>→</PillLink>
            </div>
            <PickupTabs pickup={pickupTabRows} cancellations={cancelTabRows} />
          </Container>
        </div>

        {/* R2C2 */}
        <div style={cellFill}>
          <Container title="Performance · vs STLY" subtitle="Yesterday · MTD · YTD">
            <Chart
              variant="table"
              data={perfTable}
              xKey="metric"
              series={[
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'mtd',       label: 'MTD' },
                { key: 'ytd',       label: 'YTD' },
              ]}
            />
          </Container>
        </div>

        {/* R2C3 — moved up from row 3 per PBS 2026-07-08 */}
        <div style={cellFill}>
          <Container title="Top 10 sources" subtitle="last 30 days · bookings + revenue">
            <Chart
              variant="table"
              data={topSourceRows}
              xKey="channel"
              series={[
                { key: 'bookings', label: 'Bookings' },
                { key: 'revenue',  label: 'Revenue' },
              ]}
              empty={{ title: 'No source data in window' }}
            />
          </Container>
        </div>

        {/* R3C1 — moved down from row 2 per PBS 2026-07-08 */}
        <div style={cellFill}>
          <Container
            title={`Performance · ${winDays}d`}
            subtitle={`${fmtLongDate(heroFrom)} → ${fmtLongDate(heroTo)}${offset !== 0 ? ` · ${offset > 0 ? '+' : ''}${offset}d` : ''}`}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <PillRow>
                <PillLink href={scrubHref(offset - 7)} active={false}>← 7d</PillLink>
                {offset !== 0 && <PillLink href={scrubHref(0)} active={false}>today</PillLink>}
                <PillLink href={scrubHref(offset + 7)} active={false}>7d →</PillLink>
              </PillRow>
              <PillRow>
                {(['7d','14d','30d','60d'] as const).map((w) => (
                  <PillLink key={w} href={winHref(w)} active={w === winParam}>{w}</PillLink>
                ))}
              </PillRow>
            </div>
            <Chart
              variant="line"
              data={heroData}
              xKey="night_date"
              series={heroSeries}
              height={220}
              empty={{ title: 'No data in window' }}
            />
          </Container>
        </div>

        {/* R3C2 */}
        <div style={cellFill}>
          <Container title="Upcoming events · next 30 days" subtitle="hover any day to see events">
            <MonthCalendar days={eventCalendar} variant="events" />
          </Container>
        </div>

        {/* R3C3 */}
        <div style={cellFill}>
          <Container title="Occupancy · next 30 days" subtitle="hover any day for the OCC %">
            <MonthCalendar days={occCalendar} variant="occ" />
          </Container>
        </div>
      </div>
    </DashboardPage>
  );
}

function PillRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{children}</div>;
}

function PillLink({ href, active, disabled, children }: { href: string; active: boolean; disabled?: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span style={{
        fontSize: 11, padding: '4px 10px', borderRadius: 99,
        border: '1px solid var(--hairline, #E6DFCC)',
        color: 'var(--ink-soft, #5A5A5A)', opacity: 0.4, cursor: 'not-allowed',
      }}>{children}</span>
    );
  }
  return (
    <a
      href={href}
      style={{
        fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '4px 10px', borderRadius: 99,
        border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
        background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
        color: active ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
        fontWeight: active ? 600 : 500,
        textDecoration: 'none',
      }}
    >
      {children}
    </a>
  );
}
