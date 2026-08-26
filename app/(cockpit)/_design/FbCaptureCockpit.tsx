// app/(cockpit)/_design/FbCaptureCockpit.tsx
// PBS 2026-08-26 · Restaurant Pass — the manager's half of the F&B page.
//
// The F&B sub-tab opened on a USALI rollup and a QuickBooks reconciliation:
// a controller's page. This block goes above all of that and answers what a
// restaurant manager actually asks before service — how many of the guests
// already sleeping here ate with us, which ones did not, and where that is
// heading. The ledger work below it is untouched.
//
// Drills on the SAME `op_period` pills the Operating snapshot already uses
// (yesterday | 7d | 30d | ytd) rather than introducing a second control, and
// every tile carries its SDLY pill — the same window one year earlier — per
// the design_system KpiTile house standard (size sm + stly wherever LY exists).
//
// Capture is BY RESERVATION, deliberately stricter than the reservation-day
// figure in the Operating snapshot: one guest ordering on four of five nights
// counts once here. That is the number that names a guest who bought nothing.
//
// Composed from existing atoms — Container, KpiTile, Chart, MetricMatrix.
// Data: public.v_fb_capture_trend + public.v_fb_reservation_spend.

import Container from './layout/Container';
import KpiTile from './tile/KpiTile';
import Chart from './chart/Chart';
import MetricMatrix, { type MatrixRow } from './MetricMatrix';
import type { KpiTileProps, Currency } from './types';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  captureTrend, neverSpentBySource, splitStaff, captureSummary,
  resolveWindow, shiftWindowYear, OP_PERIODS,
  type CaptureRow, type SpendRow, type OpPeriod, type Window,
} from '@/lib/fb/capture';
import { tzForProperty, propertySymbol, localTodayIso } from '@/lib/revenue/headline-matrix';

interface Props {
  propertyId: number;
  currency?: Currency;
  searchParams?: Record<string, string | string[] | undefined>;
}

const PILL_LABEL: Record<OpPeriod, string> = {
  yesterday: 'Yesterday', '7d': 'Last 7d', '30d': 'Last 30d', ytd: 'YTD',
};

export default async function FbCaptureCockpit({ propertyId: pid, currency, searchParams }: Props) {
  const sb  = getSupabaseAdmin();
  const tz  = tzForProperty(pid);
  const sym = currency ? ({ EUR: '€', USD: '$', LAK: '₭' } as const)[currency] : propertySymbol(pid);
  const today = localTodayIso(tz);

  const rawPeriod = String((searchParams ?? {}).op_period ?? '30d');
  const period = (OP_PERIODS as string[]).includes(rawPeriod) ? (rawPeriod as OpPeriod) : '30d';
  const win = resolveWindow(period, today);
  const ly  = shiftWindowYear(win);

  const spendIn = (w: Window) => sb
    .from('v_fb_reservation_spend')
    .select('source_name, is_staff, has_fb_spend, fb_spend, nights')
    .eq('property_id', pid)
    .gte('check_out_date', w.from)
    .lte('check_in_date', w.to)
    .then((r) => (r.data ?? []) as SpendRow[], () => [] as SpendRow[]);

  const [trendRes, tyRows, lyRows] = await Promise.all([
    sb.from('v_fb_capture_trend')
      .select('stay_month, reservations, reservations_with_fb, capture_pct, room_nights, room_nights_no_fb, fb_spend')
      .eq('property_id', pid)
      .gte('stay_month', `${Number(today.slice(0, 4)) - 1}-01-01`)
      .order('stay_month')
      .then((r) => (r.data ?? []) as CaptureRow[], () => [] as CaptureRow[]),
    spendIn(win),
    spendIn(ly),
  ]);

  const trend    = captureTrend(trendRes, today);
  const summary  = captureSummary(tyRows);
  const staff    = splitStaff(tyRows);
  const bySource = neverSpentBySource(tyRows);
  const lySummary = captureSummary(lyRows);
  const lyStaff   = splitStaff(lyRows);

  // No F&B charges linked to reservations for this property yet — render the
  // shell dormant so the surface stays visible and lights up when the feed
  // lands, rather than vanishing and looking like it was never built.
  const dormant = summary.reservations === 0 && trend.length === 0;
  const hasLy = lySummary.reservations > 0;

  const money = (n: number) => `${sym}${Math.round(n).toLocaleString('en-US')}`;
  const first = trend[0];
  const last  = trend.at(-1);
  const captureDelta = first && last ? Math.round((last.capturePct - first.capturePct) * 10) / 10 : null;

  const tiles: KpiTileProps[] = [
    {
      label: `Capture · ${win.label.toLowerCase()}`,
      value: dormant ? '—' : `${summary.capturePct}%`,
      size: 'sm',
      footnote: `${summary.withSpend} of ${summary.reservations} reservations bought food or drink · by reservation, not by night · ${win.label}`,
      status: dormant ? 'grey' : summary.capturePct >= 75 ? 'green' : summary.capturePct >= 60 ? 'amber' : 'red',
      stly: hasLy ? `LY ${lySummary.capturePct}%` : 'LY —',
    },
    {
      label: 'Never spent',
      value: dormant ? '—' : summary.neverSpent,
      size: 'sm',
      footnote: `${summary.roomNightsLost} room nights in house with no F&B charge at all · ${win.label}`,
      status: dormant ? 'grey' : summary.neverSpent === 0 ? 'green' : 'red',
      stly: hasLy ? `LY ${lySummary.neverSpent}` : 'LY —',
    },
    {
      label: 'Opportunity',
      value: dormant ? '—' : money(summary.opportunity),
      size: 'sm',
      footnote: `the misses valued at what a spending guest actually spends here — not a target · ${win.label}`,
      status: dormant ? 'grey' : 'amber',
      stly: hasLy ? `LY ${money(lySummary.opportunity)}` : 'LY —',
    },
    {
      label: 'Guest F&B revenue',
      value: dormant ? '—' : money(staff.guestSpend),
      size: 'sm',
      footnote: staff.staffSpend > 0
        ? `staff meals ${money(staff.staffSpend)} (${staff.staffSharePct}%) excluded — they post like guest checks · ${win.label}`
        : `no staff-usage charges in this window · ${win.label}`,
      status: dormant ? 'grey' : 'green',
      stly: hasLy ? `LY ${money(lyStaff.guestSpend)}` : 'LY —',
    },
  ];

  // Period pills — same control and same query key as the Operating snapshot
  // below, so switching period drills the whole page, not half of it.
  const pills = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {OP_PERIODS.map((p) => {
        const active = p === period;
        const qs = new URLSearchParams(
          Object.entries(searchParams ?? {}).flatMap(([k, v]) =>
            v == null || k === 'op_period' ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]],
          ),
        );
        qs.set('op_period', p);
        return (
          <a key={p} href={`?${qs.toString()}`} style={{
            padding: '3px 10px', fontSize: 10, borderRadius: 3,
            border: active ? '1px solid var(--ink, #1B1B1B)' : '1px solid var(--hairline, #E6DFCC)',
            background: active ? 'var(--ink, #1B1B1B)' : 'var(--paper, #FFFFFF)',
            color: active ? 'var(--paper, #FFFFFF)' : 'var(--ink, #1B1B1B)',
            textDecoration: 'none', fontWeight: active ? 600 : 500,
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>{PILL_LABEL[p]}</a>
        );
      })}
    </div>
  );

  const sourceRows: MatrixRow[] = bySource.slice(0, 8).map((s) => ({
    key: s.source,
    label: s.source,
    unit: `${s.didSpend + s.neverSpent} reservations`,
    cells: {
      never:   { value: String(s.neverSpent), tone: 'neg' },
      nights:  { value: String(s.roomNightsLost), tone: 'neg' },
      capture: {
        value: `${s.capturePct}%`,
        tone: s.capturePct >= 75 ? 'pos' : s.capturePct >= 50 ? 'warn' : 'neg',
        bar: s.capturePct,
      },
      spend: s.spendPerCapturing > 0 ? { value: money(s.spendPerCapturing), tone: 'mute' } : undefined,
    },
  }));

  return (
    <>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Capture snapshot"
          subtitle={`who is eating with us · by reservation · ${win.label}${hasLy ? ' · LY pill = same window last year' : ' · no last-year data for this window'}`}
          density="compact"
          action={pills}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Capture · development"
          subtitle={
            dormant
              ? 'no F&B charges linked to reservations for this property yet — lights up when the feed lands'
              : `share of reservations buying food or drink, by stay month${
                  captureDelta !== null ? ` · ${captureDelta >= 0 ? '+' : ''}${captureDelta} pts since ${first!.label}` : ''
                } · future stay months excluded, nobody has arrived yet`
          }
          density="compact"
        >
          <Chart
            variant="line"
            data={trend as unknown as Record<string, unknown>[]}
            xKey="label"
            series={[{ key: 'capturePct', label: 'Capture % of reservations', color: '#1F3A2E' }]}
            height={200}
            formatY={(v: number) => `${Math.round(v)}%`}
            empty={{ title: 'No capture history yet', hint: 'needs F&B charges linked to reservations' }}
          />
        </Container>
      </div>

      {trend.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container
            title="Room nights that bought nothing"
            subtitle="the same story as a volume — nights in house with no F&B charge, by stay month"
            density="compact"
          >
            <Chart
              variant="bar"
              data={trend as unknown as Record<string, unknown>[]}
              xKey="label"
              series={[{ key: 'roomNightsNoFb', label: 'Room nights with no F&B', color: '#B04A2F' }]}
              height={180}
              empty={{ title: 'No history yet' }}
            />
          </Container>
        </div>
      )}

      {sourceRows.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container
            title={`Who is not spending · ${win.label.toLowerCase()}`}
            subtitle="booking source sits on every POS line and nothing aggregated it — ordered by room nights lost, because that is the size of the prize"
            density="compact"
            action={pills}
          >
            <MetricMatrix
              caption="Reservations that bought no food or beverage, by booking source."
              columns={[
                { key: 'never',   label: 'Never spent', sub: 'reservations' },
                { key: 'nights',  label: 'Nights lost', sub: 'in house, no F&B' },
                { key: 'capture', label: 'Capture',     sub: 'of this source' },
                { key: 'spend',   label: 'Spend',       sub: 'when they do' },
              ]}
              rows={sourceRows}
              minWidth={520}
              labelWidth={190}
            />
          </Container>
        </div>
      )}
    </>
  );
}
