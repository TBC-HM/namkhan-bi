// app/(cockpit)/_design/OutletCaptureCockpit.tsx
// PBS 2026-08-26 · The manager's block for every Operations department page.
//
// Started as the F&B "Restaurant Pass" and generalised to all seven: Rooms,
// F&B, Spa, Activities, Retail, Transport, Other. Every one of those pages
// opened on ledger and reconciliation content — a controller's view. This
// block goes ABOVE all of it, additively: no existing container, tab or
// sub-menu is moved or removed, which is what keeps the Spa sub-pages
// (Overview / Schedule / Catalogue / Passes / Delivery) reachable untouched.
//
// One implementation, seven pages. The USALI taxonomy does not match the strip
// one-to-one — there is no Spa, Activities or Transport department, and Retail
// is booked under two different codes across the estate — so the mapping is
// resolved once in public.fn_outlet_dept_key rather than seven times here.
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
// Data: public.v_outlet_capture_trend + public.v_outlet_reservation_spend.

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
} from '@/lib/outlets/capture';
import { deptSpec, captureTone, type DeptKey } from '@/lib/outlets/departments';
import { tzForProperty, propertySymbol, localTodayIso } from '@/lib/revenue/headline-matrix';

interface Props {
  /** Which department page this block is mounted on. */
  deptKey: DeptKey;
  propertyId: number;
  currency?: Currency;
  searchParams?: Record<string, string | string[] | undefined>;
}

const PILL_LABEL: Record<OpPeriod, string> = {
  yesterday: 'Yesterday', '7d': 'Last 7d', '30d': 'Last 30d', ytd: 'YTD',
};

export default async function OutletCaptureCockpit({ deptKey, propertyId: pid, currency, searchParams }: Props) {
  const dept = deptSpec(deptKey);
  const sb  = getSupabaseAdmin();
  const tz  = tzForProperty(pid);
  const sym = currency ? ({ EUR: '€', USD: '$', LAK: '₭' } as const)[currency] : propertySymbol(pid);
  const today = localTodayIso(tz);

  const rawPeriod = String((searchParams ?? {}).op_period ?? '30d');
  const period = (OP_PERIODS as string[]).includes(rawPeriod) ? (rawPeriod as OpPeriod) : '30d';
  const win = resolveWindow(period, today);
  const ly  = shiftWindowYear(win);

  const spendIn = (w: Window) => sb
    .from('v_outlet_reservation_spend')
    .select('source_name, is_staff, has_spend, outlet_spend, nights')
    .eq('property_id', pid)
    .eq('dept_key', deptKey)
    .gte('check_out_date', w.from)
    .lte('check_in_date', w.to)
    .then((r) => (r.data ?? []) as SpendRow[], () => [] as SpendRow[]);

  const [trendRes, tyRows, lyRows] = await Promise.all([
    sb.from('v_outlet_capture_trend')
      .select('stay_month, reservations, reservations_with_spend, capture_pct, room_nights, room_nights_no_spend, outlet_spend')
      .eq('property_id', pid)
      .eq('dept_key', deptKey)
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
      footnote: `${summary.withSpend} of ${summary.reservations} reservations ${dept.verb} · by reservation, not by night · ${win.label}`,
      // Banded per department: 15% is healthy spa capture and dire F&B capture.
      // One shared threshold would paint five of seven pages permanently red.
      status: dormant ? 'grey' : captureTone(deptKey, summary.capturePct),
      stly: hasLy ? `LY ${lySummary.capturePct}%` : 'LY —',
    },
    {
      label: 'Never spent',
      value: dormant ? '—' : summary.neverSpent,
      size: 'sm',
      footnote: `${summary.roomNightsLost} room nights in house with no ${dept.label.toLowerCase()} charge at all · ${win.label}`,
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
      label: `Guest ${dept.label} revenue`,
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
          title={`${dept.label} · capture snapshot`}
          subtitle={`how many in-house guests ${dept.verb} · by reservation · ${win.label}${hasLy ? ' · LY pill = same window last year' : ' · no last-year data for this window'}`}
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
              ? `no ${dept.label.toLowerCase()} charges linked to reservations for this property yet — lights up when the feed lands`
              : `share of reservations that ${dept.verb}, by stay month${
                  captureDelta !== null ? ` · ${captureDelta >= 0 ? '+' : ''}${captureDelta} pts since ${first!.label}` : ''
                } · future stay months excluded, nobody has arrived yet`
          }
          density="compact"
        >
          <Chart
            variant="line"
            data={trend as unknown as Record<string, unknown>[]}
            xKey="label"
            series={[{ key: 'capturePct', label: `${dept.label} capture % of reservations`, color: '#1F3A2E' }]}
            height={200}
            empty={{ title: 'No capture history yet', hint: 'needs F&B charges linked to reservations' }}
          />
        </Container>
      </div>

      {trend.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container
            title="Room nights that bought nothing"
            subtitle={`the same story as a volume — nights in house with no ${dept.label.toLowerCase()} charge, by stay month`}
            density="compact"
          >
            <Chart
              variant="bar"
              data={trend as unknown as Record<string, unknown>[]}
              xKey="label"
              series={[{ key: 'roomNightsNoSpend', label: `Room nights with no ${dept.label}`, color: '#8A8A8A' }]}
              height={180}
              empty={{ title: 'No history yet' }}
            />
          </Container>
        </div>
      )}

      {dept.note && !dormant && (
        <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.45, padding: '0 2px' }}>
          {dept.note}
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
              caption={`Reservations that did not use ${dept.label}, by booking source.`}
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
