// app/revenue/reports/render/_renderers/ForecastReport.tsx
// Forecast report — pace-based projection (no statistical model). Reads
// v_otb_pace (already cross-property in task #50) for the forward 90 days.
// Disclaimer: this is directional only; for a real forecast we need a model.
// Task #75 · 2026-05-22.

import { Container, KpiTile, Chart, type ChartSeries } from '@/app/(cockpit)/_design';
import ReportBrief from './_shared/ReportBrief';
import { createClient } from '@/lib/supabase/server';
import type { ResolvedPeriod } from '@/lib/period';
import { fmtTableUsd } from '@/lib/format';

interface Props {
  period: ResolvedPeriod;
  propertyId: number;
}

interface OtbRow {
  night_date: string;
  confirmed_rooms: number | null;
  confirmed_revenue: number | null;
  rooms_stly: number | null;
}

export default async function ForecastReport({ period, propertyId }: Props) {
  const supabase = createClient();
  const sym = propertyId === 1000001 ? '€' : '$';
  const moneyCurrency: 'USD' | 'EUR' = propertyId === 1000001 ? 'EUR' : 'USD';

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from('v_otb_pace')
    .select('night_date, confirmed_rooms, confirmed_revenue, rooms_stly')
    .eq('property_id', propertyId)
    .gte('night_date', today)
    .lte('night_date', horizon)
    .order('night_date', { ascending: true });

  const rows = ((data ?? []) as OtbRow[]).map((r) => ({
    night_date: String(r.night_date),
    otb: Number(r.confirmed_rooms ?? 0),
    revenue: Number(r.confirmed_revenue ?? 0),
    stly: Number(r.rooms_stly ?? 0),
  }));

  if (rows.length === 0) {
    return (
      <Container title="No pace data" subtitle={`v_otb_pace returned 0 rows for property ${propertyId} in next 90d`} density="compact">
        <div style={{ padding: 20, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          Check upstream PMS sync — pace view should have forward rows.
        </div>
      </Container>
    );
  }

  const sumOtb     = rows.reduce((s, r) => s + r.otb, 0);
  const sumRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const sumStly    = rows.reduce((s, r) => s + r.stly, 0);
  const pacePct = sumStly > 0 ? ((sumOtb - sumStly) / sumStly) * 100 : 0;
  const avgAdr = sumOtb > 0 ? sumRevenue / sumOtb : 0;

  // Weekly bucket — group rows by ISO week-of-year for the curve table
  const weeks = new Map<string, { week_end: string; otb: number; stly: number; revenue: number }>();
  for (const r of rows) {
    const d = new Date(r.night_date + 'T00:00:00Z');
    const dayOfWeek = d.getUTCDay() || 7;
    const weekEnd = new Date(d);
    weekEnd.setUTCDate(d.getUTCDate() + (7 - dayOfWeek));
    const key = weekEnd.toISOString().slice(0, 10);
    const slot = weeks.get(key) ?? { week_end: key, otb: 0, stly: 0, revenue: 0 };
    slot.otb     += r.otb;
    slot.stly    += r.stly;
    slot.revenue += r.revenue;
    weeks.set(key, slot);
  }
  const weekRows = Array.from(weeks.values())
    .sort((a, b) => a.week_end.localeCompare(b.week_end))
    .map((w) => ({
      week_end: w.week_end,
      otb: w.otb.toLocaleString(),
      stly: w.stly > 0 ? w.stly.toLocaleString() : '—',
      delta: w.stly > 0 ? `${w.otb - w.stly >= 0 ? '+' : ''}${(w.otb - w.stly).toLocaleString()}` : '—',
      revenue: w.revenue > 0 ? (moneyCurrency === 'EUR' ? `€${Math.round(w.revenue).toLocaleString()}` : fmtTableUsd(w.revenue)) : '—',
    }));
  const weekCols: ChartSeries[] = [
    { key: 'otb',     label: 'OTB rooms' },
    { key: 'stly',    label: 'STLY rooms' },
    { key: 'delta',   label: 'Δ vs STLY' },
    { key: 'revenue', label: 'OTB revenue' },
  ];

  const briefSignal = `Next 90d · ${sumOtb.toLocaleString()} OTB rooms · pace ${pacePct >= 0 ? '+' : ''}${pacePct.toFixed(0)}% vs STLY · projected ${sym}${sumRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const briefBody = `Pace-based projection — no statistical model. Numbers reflect on-the-books only; do not include pickup expectation. Directional use only.`;
  const good: string[] = [];
  const bad: string[] = [];
  if (pacePct >= 10) good.push(`Forward pace +${pacePct.toFixed(0)}% vs STLY — strong forward demand.`);
  if (pacePct <= -10) bad.push(`Forward pace ${pacePct.toFixed(0)}% vs STLY — material softness in the next 90d.`);
  if (sumOtb === 0) bad.push('Zero OTB rooms in the next 90d — check PMS sync.');
  if (good.length === 0) good.push('Pace within ±10% of STLY.');
  if (bad.length === 0)  bad.push('No structural forward-pace risks flagged.');

  return (
    <>
      <ReportBrief signal={briefSignal} body={briefBody} good={good} bad={bad} />

      <Container title="Forward projection · next 90d" subtitle="OTB + pace · directional only" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiTile label="OTB rooms 90d" value={sumOtb} size="sm" />
          <KpiTile label="STLY rooms 90d" value={sumStly} size="sm" footnote="same-time last year" />
          <KpiTile label="Pace vs STLY" value={`${pacePct >= 0 ? '+' : ''}${pacePct.toFixed(1)}%`} size="sm"
            status={pacePct >= 5 ? 'green' : pacePct <= -5 ? 'amber' : 'grey'} />
          <KpiTile label="OTB revenue" value={Math.round(sumRevenue)} currency={moneyCurrency} size="sm" />
          <KpiTile label="Avg ADR (OTB)" value={Math.round(avgAdr)} currency={moneyCurrency} size="sm" />
        </div>
      </Container>

      <Container title="Weekly pace curve" subtitle={`${weekRows.length} weeks of OTB vs STLY`}>
        <Chart variant="table" data={weekRows} xKey="week_end" series={weekCols}
          empty={{ title: 'No weekly buckets' }} />
      </Container>

      <Container title="Disclaimer" density="compact">
        <div style={{ fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.6 }}>
          This is a <strong>pace-based projection</strong>, not a statistical forecast. It reads on-the-books rooms + revenue from <code>v_otb_pace</code> and compares to same-time-last-year (STLY). No pickup model, no seasonality adjustment, no booking-curve extrapolation. Use for directional read only; do not commit to ADR or RevPAR numbers from this report.
        </div>
      </Container>
    </>
  );
}
