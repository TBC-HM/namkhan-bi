// app/revenue/pulse/page.tsx — REBUILT 2026-05-18 to mirror Cloudbeds Price
// Intelligence Overview layout. PBS-locked design:
//   1. Header: today's date label + reload affordance
//   2. KPI strip — 4 tiles (Occupancy · RevPAR · RoomNightsSold · ADR) + Δ vs STLY
//   3. Performance summary — Yesterday / MTD / YTD across Occupancy/RevPAR/ADR
//   4. Hero — Performance (Nd) chart with ← → scrub + window length toggle + LY overlay
//   5. Top 5 sources (last 30d)
//   6. Upcoming high occupancy (>80%) calendar (month view, navigable)
//   7. Today's pickup (accommodation · window · avg LOS)
//   8. Upcoming events (next 30d)
// Rate-rule alerts (Cloudbeds-only) intentionally dropped (PBS 2026-05-18).
//
// Single source of truth: this body renders for both Namkhan and Donna via
// PulseShell. Accepts optional propertyId prop (default = PROPERTY_ID).

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
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
  getPulseUpcomingEvents,
  type PulseDailyRow,
  type PulseKpiSnapshot,
  type PulseSourceRow,
  type PulseHighOccDay,
  type PulsePickupRow,
  type PulseEventRow,
} from '@/lib/data-pulse';
import PerformanceHero from './_components/PerformanceHero';
import HighOccCalendar from './_components/HighOccCalendar';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
  propertyId?: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function deltaPct(now: number, prior: number | null): number | null {
  if (prior == null || prior === 0) return null;
  return ((now - prior) / prior) * 100;
}

export default async function PulsePage({ searchParams, propertyId }: Props) {
  const pid = propertyId ?? PROPERTY_ID;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);

  // Scrub state — `?offset=N` (days from today). 0 = today as anchor.
  // `?win=Nd` — chart window length. Cloudbeds defaults to 30.
  const offsetParam = typeof searchParams.offset === 'string' ? searchParams.offset : '0';
  const winParam = typeof searchParams.win === 'string' ? searchParams.win : '30d';
  const offset = Math.max(-365, Math.min(365, parseInt(offsetParam, 10) || 0));
  const winDays = winParam === '7d' ? 7 : winParam === '14d' ? 14 : winParam === '60d' ? 60 : 30;

  // PBS 2026-05-18: Today's Pickup is navigable — `?pickupOffset=N`, clamped
  // to [-8, 0]. 0 = today, -1 = yesterday, … -8 = 8 days back. No forward
  // navigation past today (you can't pick up bookings made in the future).
  const pickupOffsetParam = typeof searchParams.pickupOffset === 'string' ? searchParams.pickupOffset : '0';
  const pickupOffset = Math.max(-8, Math.min(0, parseInt(pickupOffsetParam, 10) || 0));

  const anchor = todayIso();
  const heroFrom = shiftDate(anchor, offset);
  const heroTo = shiftDate(anchor, offset + winDays - 1);

  // STLY range (-365 days)
  const stlyFrom = shiftDate(heroFrom, -365);
  const stlyTo = shiftDate(heroTo, -365);

  // KPI strip + Perf summary anchor at TODAY (independent of scrub).
  const [headline, summary, dailyRows, stlyDailyRows, topSources, highOcc, pickup, events] =
    await Promise.all([
      getPulseHeadlineKpis(pid, anchor),
      getPulsePerformanceSummary(pid, anchor),
      getPulseDaily(pid, heroFrom, heroTo),
      getPulseDaily(pid, stlyFrom, stlyTo),
      getPulseTopSources(pid, 30, 5),
      getPulseHighOcc(pid, anchor, shiftDate(anchor, 60), 80),
      getPulseTodayPickup(pid, shiftDate(anchor, pickupOffset)),
      getPulseUpcomingEvents(pid, anchor, shiftDate(anchor, 30), 10),
    ]);

  const occΔ = deltaPct(headline.occupancyPct, headline.stlyOccupancyPct);
  const revparΔ = deltaPct(headline.revpar, headline.stlyRevpar);
  const rnsΔ = deltaPct(headline.roomsSold, headline.stlyRoomsSold);
  const adrΔ = deltaPct(headline.adr, headline.stlyAdr);

  // Build hero-chart input (align STLY rows to current dates so the X-axis matches).
  const stlyByCurrentDate = new Map<string, PulseDailyRow>();
  for (const r of stlyDailyRows) {
    stlyByCurrentDate.set(shiftDate(r.night_date, 365), r);
  }
  const heroRows = dailyRows.map((r) => ({
    ...r,
    stly_occupancy_pct: stlyByCurrentDate.get(r.night_date)?.occupancy_pct ?? null,
    stly_adr: stlyByCurrentDate.get(r.night_date)?.adr ?? null,
    stly_revpar: stlyByCurrentDate.get(r.night_date)?.revpar ?? null,
  }));

  const ctx = (kind: 'panel' | 'kpi' | 'brief' | 'table', title: string, signal?: string) => ({
    kind,
    title,
    signal,
    dept: 'revenue' as const,
  });

  // Scrub URL builders
  const scrubHref = (newOffset: number) => {
    const p = new URLSearchParams();
    if (newOffset !== 0) p.set('offset', String(newOffset));
    if (winParam !== '30d') p.set('win', winParam);
    return `/revenue/pulse${p.toString() ? '?' + p.toString() : ''}`;
  };
  const winHref = (newWin: string) => {
    const p = new URLSearchParams();
    if (offset !== 0) p.set('offset', String(offset));
    if (newWin !== '30d') p.set('win', newWin);
    if (pickupOffset !== 0) p.set('pickupOffset', String(pickupOffset));
    return `/revenue/pulse${p.toString() ? '?' + p.toString() : ''}`;
  };

  // Today's Pickup ← / → href builder
  const pickupHref = (newPickupOffset: number) => {
    const clamped = Math.max(-8, Math.min(0, newPickupOffset));
    const p = new URLSearchParams();
    if (offset !== 0) p.set('offset', String(offset));
    if (winParam !== '30d') p.set('win', winParam);
    if (clamped !== 0) p.set('pickupOffset', String(clamped));
    return `/revenue/pulse${p.toString() ? '?' + p.toString() : ''}`;
  };
  const pickupDate = shiftDate(anchor, pickupOffset);
  const pickupLabel =
    pickupOffset === 0 ? 'Today' : pickupOffset === -1 ? 'Yesterday' : `${Math.abs(pickupOffset)} days ago`;

  return (
    <Page
      eyebrow={`Revenue · Pulse · ${fmtLongDate(anchor)}`}
      title={
        <>
          What&apos;s <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>open</em>, right now.
        </>
      }
      subPages={subPages}
    >
      {/* ── Row 1: KPI strip (left) + Performance summary (right) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginTop: 14 }}>
        {/* KPI strip — Cloudbeds 4-tile cluster */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <KpiBox
            value={headline.occupancyPct}
            unit="pct"
            label="Occupancy"
            compare={occΔ != null ? { value: occΔ, unit: 'pct', period: 'vs STLY' } : undefined}
            tooltip="Yesterday occupancy. mv_kpi_daily, property-filtered."
          />
          <KpiBox
            value={headline.revpar}
            unit="usd"
            label="RevPAR"
            compare={revparΔ != null ? { value: revparΔ, unit: 'pct', period: 'vs STLY' } : undefined}
            tooltip="Revenue per available room — yesterday."
          />
          <KpiBox
            value={headline.roomsSold}
            unit="count"
            label="Room Nights Sold"
            compare={rnsΔ != null ? { value: rnsΔ, unit: 'pct', period: 'vs STLY' } : undefined}
            tooltip="Confirmed room-nights sold for yesterday."
          />
          <KpiBox
            value={headline.adr}
            unit="usd"
            label="ADR"
            compare={adrΔ != null ? { value: adrΔ, unit: 'pct', period: 'vs STLY' } : undefined}
            tooltip="Average daily rate — yesterday."
          />
        </div>

        {/* Performance summary — Yesterday / MTD / YTD */}
        <Panel title="Performance" eyebrow="vs same time last year" expandable={false}>
          <div style={{ padding: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--tbl-border-strong, var(--paper-deep))' }}>
                  <th />
                  <th style={th()}>Yesterday</th>
                  <th style={th()}>MTD</th>
                  <th style={th()}>YTD</th>
                </tr>
              </thead>
              <tbody>
                <SummaryRow label="Occupancy" unit="pct" yest={summary.yesterday} mtd={summary.mtd} ytd={summary.ytd} field="occupancyPct" stlyField="stlyOccupancyPct" />
                <SummaryRow label="RevPAR"    unit="usd" yest={summary.yesterday} mtd={summary.mtd} ytd={summary.ytd} field="revpar"        stlyField="stlyRevpar"        />
                <SummaryRow label="ADR"       unit="usd" yest={summary.yesterday} mtd={summary.mtd} ytd={summary.ytd} field="adr"           stlyField="stlyAdr"           />
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div style={{ height: 14 }} />

      {/* ── Row 2: Hero — Performance (30/14/7d) with scrub ── */}
      <Panel
        title={`Performance (${winDays} days)`}
        eyebrow={`${fmtLongDate(heroFrom)} → ${fmtLongDate(heroTo)}${offset !== 0 ? ` · ${offset > 0 ? '+' : ''}${offset}d` : ''}`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href={scrubHref(offset - 7)} style={navBtn()} title="Back 7 days">←</a>
            {offset !== 0 && (
              <a href={scrubHref(0)} style={navBtn()} title="Reset to today">today</a>
            )}
            <a href={scrubHref(offset + 7)} style={navBtn()} title="Forward 7 days">→</a>
            <span style={{ width: 8 }} />
            {(['7d', '14d', '30d', '60d'] as const).map((w) => (
              <a
                key={w}
                href={winHref(w)}
                style={{
                  ...navBtn(),
                  background: w === winParam ? 'var(--brass, #a8854a)' : 'transparent',
                  color: w === winParam ? 'var(--page-bg, #0a0a0a)' : 'var(--brass, #a8854a)',
                }}
              >
                {w}
              </a>
            ))}
            <ArtifactActions context={ctx('panel', `Performance ${winDays}d`)} />
          </div>
        }
      >
        <div style={{ padding: 14 }}>
          {heroRows.length === 0 ? (
            <Empty>No data in window.</Empty>
          ) : (
            <PerformanceHero rows={heroRows} />
          )}
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      {/* ── Row 3: Top 5 sources (left, half-width) + Upcoming high occupancy (right) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
        <Panel title="Top 5 sources" eyebrow="last 30 days · accommodations booked">
          <div style={{ padding: 14, overflowX: 'auto' }}>
            {topSources.length === 0 ? (
              <Empty>No source data in window.</Empty>
            ) : (
              <table style={{ width: '100%', fontSize: 'var(--t-sm)', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--tbl-border-strong, var(--paper-deep))' }}>
                    <th style={th()}>Booking channel</th>
                    <th style={{ ...th(), textAlign: 'right' }}>Booked</th>
                  </tr>
                </thead>
                <tbody>
                  {topSources.map((s: PulseSourceRow) => (
                    <tr key={s.source_name} style={{ borderBottom: '1px solid var(--tbl-border, var(--paper-deep))' }}>
                      <td style={td()}>{s.source_name}</td>
                      <td style={td({ mono: true, right: true })}>{s.bookings.toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <Panel title="Upcoming high occupancy" eyebrow="next 60 days · ≥80%">
          <div style={{ padding: 14 }}>
            <HighOccCalendar anchor={anchor} highDays={highOcc} />
          </div>
        </Panel>
      </div>

      <div style={{ height: 14 }} />

      {/* ── Row 4: Today's pickup + Upcoming events ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
        <Panel
          title={`${pickupLabel}'s pickup`}
          eyebrow={`booked on ${fmtLongDate(pickupDate)}`}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <a
                href={pickupHref(pickupOffset - 1)}
                style={{ ...navBtn(), opacity: pickupOffset <= -8 ? 0.35 : 1, pointerEvents: pickupOffset <= -8 ? 'none' : 'auto' }}
                title="Back 1 day"
              >
                ←
              </a>
              {pickupOffset !== 0 && (
                <a href={pickupHref(0)} style={navBtn()} title="Back to today">today</a>
              )}
              <a
                href={pickupHref(pickupOffset + 1)}
                style={{ ...navBtn(), opacity: pickupOffset >= 0 ? 0.35 : 1, pointerEvents: pickupOffset >= 0 ? 'none' : 'auto' }}
                title="Forward 1 day"
              >
                →
              </a>
            </div>
          }
        >
          <div style={{ padding: 14, overflowX: 'auto' }}>
            {pickup.length === 0 ? (
              <Empty>None available.</Empty>
            ) : (
              <table style={{ width: '100%', fontSize: 'var(--t-sm)', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--tbl-border-strong, var(--paper-deep))' }}>
                    <th style={th()}>Accommodation</th>
                    <th style={{ ...th(), textAlign: 'right' }}>Window</th>
                    <th style={{ ...th(), textAlign: 'right' }}>Avg LOS</th>
                  </tr>
                </thead>
                <tbody>
                  {pickup.map((p: PulsePickupRow) => (
                    <tr key={p.accommodation} style={{ borderBottom: '1px solid var(--tbl-border, var(--paper-deep))' }}>
                      <td style={td({ weight: 600 })}>{p.accommodation}</td>
                      <td style={td({ mono: true, right: true })}>{p.window}</td>
                      <td style={td({ mono: true, right: true })}>{p.avg_los.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <Panel title="Upcoming events" eyebrow="next 30 days">
          <div style={{ padding: 14, overflowX: 'auto' }}>
            {events.length === 0 ? (
              <Empty>None available.</Empty>
            ) : (
              <table style={{ width: '100%', fontSize: 'var(--t-sm)', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--tbl-border-strong, var(--paper-deep))' }}>
                    <th style={th()}>Event</th>
                    <th style={{ ...th(), textAlign: 'right' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e: PulseEventRow) => (
                    <tr key={`${e.name}-${e.date}`} style={{ borderBottom: '1px solid var(--tbl-border, var(--paper-deep))' }}>
                      <td style={td({ weight: 600 })}>{e.name}</td>
                      <td style={td({ mono: true, right: true })}>{e.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
      </div>
    </Page>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────

function SummaryRow({
  label,
  unit,
  yest,
  mtd,
  ytd,
  field,
  stlyField,
}: {
  label: string;
  unit: 'pct' | 'usd';
  yest: PulseKpiSnapshot;
  mtd: PulseKpiSnapshot;
  ytd: PulseKpiSnapshot;
  field: keyof PulseKpiSnapshot;
  stlyField: keyof PulseKpiSnapshot;
}) {
  return (
    <tr style={{ borderBottom: '1px solid var(--tbl-border, var(--paper-deep))' }}>
      <td style={td({ weight: 600 })}>{label}</td>
      <SummaryCell snap={yest} unit={unit} field={field} stlyField={stlyField} />
      <SummaryCell snap={mtd}  unit={unit} field={field} stlyField={stlyField} />
      <SummaryCell snap={ytd}  unit={unit} field={field} stlyField={stlyField} />
    </tr>
  );
}

function SummaryCell({
  snap,
  unit,
  field,
  stlyField,
}: {
  snap: PulseKpiSnapshot;
  unit: 'pct' | 'usd';
  field: keyof PulseKpiSnapshot;
  stlyField: keyof PulseKpiSnapshot;
}) {
  const now = Number(snap[field] ?? 0);
  const stly = snap[stlyField] as number | null;
  const Δpct = stly != null && stly !== 0 ? ((now - stly) / stly) * 100 : null;
  const arrow = Δpct == null ? '' : Δpct > 0 ? '↑' : Δpct < 0 ? '↓' : '·';
  const tone =
    Δpct == null ? 'var(--ink-mute, #7d7565)' : Δpct >= 0 ? 'var(--moss, #2D6A4F)' : '#E07856';
  const valFmt = unit === 'pct'
    ? `${now.toFixed(2)}%`
    : `$${Math.round(now).toLocaleString('en-US')}`;
  return (
    <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ color: 'var(--tbl-fg, var(--ink, #1a1a1a))', fontWeight: 600 }}>{valFmt}</div>
      {Δpct != null && (
        <div style={{ marginTop: 2, fontSize: 'var(--t-xs)', color: tone }}>
          {arrow} {Math.abs(Δpct).toFixed(2)}%
        </div>
      )}
    </td>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute, #7d7565)', fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', fontStyle: 'italic' }}>
      {children}
    </div>
  );
}

function th(): React.CSSProperties {
  return {
    textAlign: 'left',
    padding: '8px 6px',
    color: 'var(--tbl-fg-mute, var(--ink-mute, #7d7565))',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    fontWeight: 600,
  };
}

function td(opts: { mono?: boolean; right?: boolean; mute?: boolean; weight?: number } = {}): React.CSSProperties {
  return {
    padding: '8px 6px',
    fontFamily: opts.mono ? 'var(--mono)' : 'inherit',
    textAlign: opts.right ? 'right' : 'left',
    color: opts.mute ? 'var(--tbl-fg-mute, var(--ink-mute, #7d7565))' : 'var(--tbl-fg, var(--ink, #1a1a1a))',
    fontWeight: opts.weight ?? 400,
    fontVariantNumeric: opts.mono ? 'tabular-nums' : 'normal',
  };
}

function navBtn(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    height: 26,
    padding: '0 8px',
    border: '1px solid var(--brass, #a8854a)',
    borderRadius: 3,
    background: 'transparent',
    color: 'var(--brass, #a8854a)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.05em',
    textDecoration: 'none',
    cursor: 'pointer',
  };
}
