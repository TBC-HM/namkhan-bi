// app/(cockpit)/_design/FbCaptureCockpit.tsx
// PBS 2026-08-26 · Restaurant Pass — the manager's half of the F&B page.
//
// The F&B sub-tab opened on a USALI rollup and a QuickBooks reconciliation:
// a controller's page. This block goes above all of that and answers what a
// restaurant manager actually asks before service — how many of the guests
// already sleeping here ate with us, which ones did not, and where that is
// heading. The ledger work below it is untouched.
//
// Capture is BY RESERVATION, deliberately stricter than the reservation-day
// figure in the Operating snapshot: one guest ordering on four of five nights
// counts once here. That is the number that names a guest who bought nothing.
//
// Composed from existing atoms — Container, KpiTile, Chart, MetricMatrix.
// Data: public.v_fb_capture_trend + public.v_fb_reservation_spend (gold views
// kpi.v_fb_capture_monthly_property / kpi.v_fb_reservation_spend, 2026-08-26).

import Container from './layout/Container';
import KpiTile from './tile/KpiTile';
import Chart from './chart/Chart';
import MetricMatrix, { type MatrixRow } from './MetricMatrix';
import type { KpiTileProps, Currency } from './types';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  captureTrend, neverSpentBySource, splitStaff, captureSummary,
  type CaptureRow, type SpendRow,
} from '@/lib/fb/capture';
import { tzForProperty, propertySymbol, localTodayIso, addDays } from '@/lib/revenue/headline-matrix';

interface Props {
  propertyId: number;
  currency?: Currency;
  /** Trailing window for the capture cohort. Default 30 days. */
  windowDays?: number;
}

export default async function FbCaptureCockpit({
  propertyId: pid, currency, windowDays = 30,
}: Props) {
  const sb  = getSupabaseAdmin();
  const tz  = tzForProperty(pid);
  const sym = currency ? ({ EUR: '€', USD: '$', LAK: '₭' } as const)[currency] : propertySymbol(pid);
  const today = localTodayIso(tz);
  const from  = addDays(today, -windowDays);

  const [trendRes, spendRes] = await Promise.all([
    sb.from('v_fb_capture_trend')
      .select('stay_month, reservations, reservations_with_fb, capture_pct, room_nights, room_nights_no_fb, fb_spend')
      .eq('property_id', pid)
      .gte('stay_month', `${Number(today.slice(0, 4)) - 1}-01-01`)
      .order('stay_month')
      .then((r) => (r.data ?? []) as CaptureRow[], () => [] as CaptureRow[]),
    sb.from('v_fb_reservation_spend')
      .select('source_name, is_staff, has_fb_spend, fb_spend, nights, check_in_date, check_out_date')
      .eq('property_id', pid)
      .gte('check_out_date', from)
      .lte('check_in_date', today)
      .then((r) => (r.data ?? []) as SpendRow[], () => [] as SpendRow[]),
  ]);

  const trend   = captureTrend(trendRes, today);
  const summary = captureSummary(spendRes);
  const staff   = splitStaff(spendRes);
  const bySource = neverSpentBySource(spendRes);

  // Nothing has been instrumented for this property yet — render the shell so
  // the surface is visible and lights up when the feed lands, rather than
  // disappearing and looking like it was never built.
  const dormant = summary.reservations === 0 && trend.length === 0;

  const first = trend[0];
  const last  = trend.at(-1);
  const captureDelta = first && last ? Math.round((last.capturePct - first.capturePct) * 10) / 10 : null;

  const money = (n: number) => `${sym}${Math.round(n).toLocaleString('en-US')}`;

  const tiles: KpiTileProps[] = [
    {
      label: `Capture · last ${windowDays}d`,
      value: dormant ? '—' : `${summary.capturePct}%`,
      size: 'sm',
      footnote: `${summary.withSpend} of ${summary.reservations} reservations bought food or drink · by reservation, not by night`,
      status: dormant ? 'grey' : summary.capturePct >= 75 ? 'green' : summary.capturePct >= 60 ? 'amber' : 'red',
      stly: first ? `LY —` : undefined,
    },
    {
      label: 'Never spent',
      value: dormant ? '—' : summary.neverSpent,
      size: 'sm',
      footnote: `${summary.roomNightsLost} room nights in house with no F&B charge at all`,
      status: dormant ? 'grey' : summary.neverSpent === 0 ? 'green' : 'red',
    },
    {
      label: 'Opportunity',
      value: dormant ? '—' : money(summary.opportunity),
      size: 'sm',
      footnote: 'the misses valued at what a spending guest actually spends here — not a target',
      status: dormant ? 'grey' : 'amber',
    },
    {
      label: 'Guest F&B revenue',
      value: dormant ? '—' : money(staff.guestSpend),
      size: 'sm',
      footnote: staff.staffSpend > 0
        ? `staff meals ${money(staff.staffSpend)} (${staff.staffSharePct}%) excluded — they post like guest checks`
        : 'no staff-usage charges in this window',
      status: dormant ? 'grey' : 'green',
    },
  ];

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
      spend: s.spendPerCapturing > 0
        ? { value: money(s.spendPerCapturing), tone: 'mute' }
        : undefined,
    },
  }));

  return (
    <>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Capture · development"
          subtitle={
            dormant
              ? 'no F&B charges linked to reservations for this property yet — lights up when the feed lands'
              : `share of reservations buying food or drink, by stay month${
                  captureDelta !== null
                    ? ` · ${captureDelta >= 0 ? '+' : ''}${captureDelta} pts since ${first!.label}`
                    : ''
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
            title={`Who is not spending · last ${windowDays} days`}
            subtitle="booking source sits on every POS line and nothing aggregated it — ordered by room nights lost, because that is the size of the prize"
            density="compact"
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
