// app/revenue/reports/render/_renderers/PaceReport.tsx
// Pace report — ported to primitives.

import { Container, KpiTile, Chart, type ChartSeries } from '@/app/(cockpit)/_design';
import ReportBrief from './_shared/ReportBrief';
import { getOverviewKpis, getChannelPerf } from '@/lib/data';
import { getPaceCurve, getDailyRevenueForRange } from '@/lib/pulseData';
import type { ResolvedPeriod } from '@/lib/period';
import { fmtTableUsd } from '@/lib/format';

interface Props { period: ResolvedPeriod }

export default async function PaceReport({ period }: Props) {
  const [kpis, paceCurve, rangeRev, channels] = await Promise.all([
    getOverviewKpis(period).catch(() => ({ current: null, compare: null } as Record<string, unknown>)),
    getPaceCurve(30, 30).catch(() => [] as Record<string, unknown>[]),
    getDailyRevenueForRange(period.from, period.to).catch(() => [] as Record<string, unknown>[]),
    getChannelPerf(period).catch(() => [] as Record<string, unknown>[]),
  ]);

  const cur = (kpis as { current?: Record<string, unknown> }).current;
  const cmp = (kpis as { compare?: Record<string, unknown> }).compare;
  const occ     = Number(cur?.occupancy_pct ?? 0);
  const adr     = Number(cur?.adr_usd ?? 0);
  const revpar  = Number(cur?.revpar_usd ?? 0);
  const trevpar = Number(cur?.trevpar_usd ?? 0);

  const cmpLabel = period.cmpLabel ? period.cmpLabel.replace(/^vs\s+/i, '') : '';
  const dOcc     = cmp ? occ     - Number(cmp.occupancy_pct ?? 0) : null;
  const dAdr     = cmp ? adr     - Number(cmp.adr_usd        ?? 0) : null;
  const dRevpar  = cmp ? revpar  - Number(cmp.revpar_usd     ?? 0) : null;
  const dTrevpar = cmp ? trevpar - Number(cmp.trevpar_usd    ?? 0) : null;

  const totalRevWindow = (rangeRev as Array<Record<string, unknown>>).reduce(
    (s, r) => s + Number(r.revenue_actual_usd ?? 0), 0,
  );

  const past = (paceCurve as Array<Record<string, unknown>>).filter((r) => Number(r.day_offset) < 0);
  const fwd  = (paceCurve as Array<Record<string, unknown>>).filter((r) => Number(r.day_offset) >= 0);
  const sumActualPast = past.reduce((s, r) => s + Number(r.actual ?? 0), 0);
  const sumStlyPast   = past.reduce((s, r) => s + Number(r.stly   ?? 0), 0);
  const sumOtbFwd     = fwd .reduce((s, r) => s + Number(r.otb    ?? 0), 0);
  const sumStlyFwd    = fwd .reduce((s, r) => s + Number(r.stly   ?? 0), 0);
  const pacePastPct = sumStlyPast > 0 ? ((sumActualPast - sumStlyPast) / sumStlyPast) * 100 : 0;
  const paceFwdPct  = sumStlyFwd  > 0 ? ((sumOtbFwd     - sumStlyFwd ) / sumStlyFwd ) * 100 : 0;

  const briefSignal = `${period.label} · pace fwd ${paceFwdPct >= 0 ? '+' : ''}${paceFwdPct.toFixed(0)}% vs STLY · past ${pacePastPct >= 0 ? '+' : ''}${pacePastPct.toFixed(0)}% vs STLY`;
  const briefBody = `Window revenue $${totalRevWindow.toLocaleString(undefined, { maximumFractionDigits: 0 })} · OCC ${occ.toFixed(0)}% · ADR $${adr.toFixed(0)} · RevPAR $${revpar.toFixed(0)}.`;
  const good: string[] = [];
  const bad:  string[] = [];
  if (paceFwdPct >= 5)  good.push(`Forward pace +${paceFwdPct.toFixed(0)}% vs STLY — protect rate.`);
  if (paceFwdPct <= -5) bad.push (`Forward pace ${paceFwdPct.toFixed(0)}% vs STLY — pickup risk; check pricing & channel mix.`);
  if (pacePastPct >= 5) good.push(`Past pace +${pacePastPct.toFixed(0)}% vs STLY — strong base.`);
  if (pacePastPct <= -5) bad.push(`Past pace ${pacePastPct.toFixed(0)}% vs STLY — softness in the rear-view.`);
  if (good.length === 0) good.push('Pace flat / mixed against STLY.');
  if (bad.length === 0)  bad.push ('No structural pace risk flagged.');

  if (paceCurve.length === 0 && channels.length === 0) {
    return (
      <Container title="No data" subtitle={`Pace curve view returned 0 rows for ${period.label}`} density="compact">
        <div style={{ padding: 20, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          Try widening the window or check the upstream pulseData feed.
        </div>
      </Container>
    );
  }

  const paceRows = (paceCurve as Array<Record<string, unknown>>).map((r) => {
    const offset = r.day_offset != null ? Number(r.day_offset) : null;
    return {
      day:    offset != null ? `${offset > 0 ? '+' : ''}${offset}d` : String(r.day ?? '—'),
      actual: r.actual != null ? fmtTableUsd(Number(r.actual)) : '—',
      otb:    r.otb    != null ? fmtTableUsd(Number(r.otb))    : '—',
      stly:   r.stly   != null ? fmtTableUsd(Number(r.stly))   : '—',
      budget: r.budget != null ? fmtTableUsd(Number(r.budget)) : '—',
    };
  });
  const paceCols: ChartSeries[] = [
    { key: 'actual', label: 'Actual' },
    { key: 'otb',    label: 'OTB' },
    { key: 'stly',   label: 'STLY' },
    { key: 'budget', label: 'Budget' },
  ];

  return (
    <>
      <ReportBrief signal={briefSignal} body={briefBody} good={good} bad={bad} />

      <Container title="Headline KPIs" subtitle="this period" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiTile label="Occupancy" value={`${occ.toFixed(1)}%`} size="sm"
            delta={dOcc != null ? { value: dOcc, period: cmpLabel, direction: dOcc >= 0 ? 'up' : 'down' } : undefined} />
          <KpiTile label="ADR" value={Math.round(adr)} currency="USD" size="sm"
            delta={dAdr != null ? { value: dAdr, period: cmpLabel, direction: dAdr >= 0 ? 'up' : 'down' } : undefined} />
          <KpiTile label="RevPAR" value={Math.round(revpar)} currency="USD" size="sm"
            delta={dRevpar != null ? { value: dRevpar, period: cmpLabel, direction: dRevpar >= 0 ? 'up' : 'down' } : undefined} />
          <KpiTile label="TRevPAR" value={Math.round(trevpar)} currency="USD" size="sm"
            delta={dTrevpar != null ? { value: dTrevpar, period: cmpLabel, direction: dTrevpar >= 0 ? 'up' : 'down' } : undefined} />
          <KpiTile label="Total revenue · window" value={Math.round(totalRevWindow)} currency="USD" size="sm"
            footnote={period.label} />
        </div>
      </Container>

      <Container title="Pace curve · −30d → +30d" subtitle="actual / OTB / STLY / budget">
        <Chart variant="table" data={paceRows} xKey="day" series={paceCols}
          empty={{ title: 'No pace data', hint: 'pulseData.getPaceCurve returned 0 rows' }} />
      </Container>
    </>
  );
}
