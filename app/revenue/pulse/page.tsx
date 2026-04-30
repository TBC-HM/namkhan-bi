// app/revenue/pulse/page.tsx
// Revenue · Pulse — redesign v2 (Federico, 30 Apr 2026).
// 12-KPI grid (4 wired + 8 "data needed"), decisions queue placeholder, tactical alerts placeholder, 90d chart.
// Layout: layout.tsx already provides Banner / SubNav / FilterStrip. We render hero + grid + sections only.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { DailyRevenueChart } from '@/components/charts/DailyRevenueChart';
import { getKpiDaily, aggregateDaily, getKpiDailyCompare } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function PulsePage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  const dailyPeriod = await getKpiDaily(period).catch(() => []);
  const aggPeriod = aggregateDaily(dailyPeriod);

  const dailyCompare = await getKpiDailyCompare(period).catch(() => null);
  const aggCompare = dailyCompare ? aggregateDaily(dailyCompare) : null;

  const chartTo = new Date();
  const chartFrom = new Date(chartTo.getTime() - 90 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const d90 = await getKpiDaily(fmt(chartFrom), fmt(chartTo)).catch(() => []);

  const dlabel = `${period.days}d`;

  // Delta helper
  const delta = (cur: number, prev: number | undefined): { text?: string; tone?: 'pos' | 'neg' } => {
    if (prev == null || prev === 0) return {};
    const d = ((cur - prev) / prev) * 100;
    const sign = d >= 0 ? '+' : '';
    const lbl = period.cmp === 'stly' ? 'STLY' : 'PP';
    return {
      text: `${sign}${d.toFixed(1)}% vs ${lbl}`,
      tone: d >= 0 ? 'pos' : 'neg',
    };
  };

  const occD = delta(aggPeriod?.occupancy_pct ?? 0, aggCompare?.occupancy_pct);
  const adrD = delta(aggPeriod?.adr ?? 0, aggCompare?.adr);
  const rpD = delta(aggPeriod?.revpar ?? 0, aggCompare?.revpar);
  const trpD = delta(aggPeriod?.trevpar ?? 0, aggCompare?.trevpar);

  return (
    <>
      <PanelHero
        eyebrow={`Pulse · ${period.label}`}
        title="Revenue"
        emphasis="performance"
        sub={`${period.rangeLabel}${aggCompare ? ` · compare ${period.compareFrom} → ${period.compareTo}` : ''}`}
        kpis={
          <>
            <KpiCard
              label={`Occupancy ${dlabel}`}
              value={aggPeriod?.occupancy_pct ?? 0}
              kind="pct"
              delta={occD.text}
              deltaTone={occD.tone}
            />
            <KpiCard
              label={`ADR ${dlabel}`}
              value={aggPeriod?.adr ?? 0}
              kind="money"
              delta={adrD.text}
              deltaTone={adrD.tone}
            />
            <KpiCard
              label={`RevPAR ${dlabel}`}
              value={aggPeriod?.revpar ?? 0}
              kind="money"
              delta={rpD.text}
              deltaTone={rpD.tone}
            />
            <KpiCard
              label={`TRevPAR ${dlabel}`}
              value={aggPeriod?.trevpar ?? 0}
              kind="money"
              delta={trpD.text}
              deltaTone={trpD.tone}
            />
          </>
        }
      />

      {/* Pilot banner — Cloudbeds writes require human approval (90d). */}
      <div
        className="card"
        style={{
          background: 'rgba(196, 100, 38, 0.08)',
          borderColor: 'rgba(196, 100, 38, 0.45)',
          marginBottom: 16,
        }}
      >
        <div style={{ padding: 14, fontSize: 13, lineHeight: 1.5 }}>
          <strong>Pilot mode · 90 days.</strong>{' '}
          Every rate, restriction, and rate-plan retire goes through human approval before it
          touches Cloudbeds. Agents propose; you decide.
        </div>
      </div>

      {/* Row 2 — 8 new KPIs from redesign spec, all "data needed" until source is wired. */}
      <Card
        title="Performance KPIs"
        emphasis="extended"
        sub="Six new tiles per redesign · sources wiring in next deploys"
      >
        <div className="card-grid-4">
          <KpiCard label="Net ADR" value={null} kind="money" greyed hint="data needed · OTA commissions" />
          <KpiCard label="GOPPAR" value={null} kind="money" greyed hint="data needed · monthly P&L" />
          <KpiCard label="Cancel %" value={null} kind="pct" greyed hint="data needed · reservations" />
          <KpiCard label="No-Show %" value={null} kind="pct" greyed hint="data needed · reservations" />
          <KpiCard label="Lead Time" value={null} greyed hint="data needed · booking date" />
          <KpiCard label="ALOS" value={null} greyed hint="data needed · stay nights" />
          <KpiCard label="Commission $" value={null} kind="money" greyed hint="data needed · channel cost" />
          <KpiCard label="Forecast +30d" value={null} kind="money" greyed hint="paused · needs 90d history" />
        </div>
      </Card>

      <Card
        title="Decisions queued for you"
        emphasis="ranked by $ impact"
        sub="Tactical Detector · 12-action queue · enabled when cube ships (P2)"
      >
        <div className="stub">
          <h3>Coming in Deploy 2 (Pace/Channels) and Deploy 3 (Tactical wired)</h3>
          <p>
            5–15 ranked decision cards with severity, $ impact, recommended actions, and an Apply
            button gated by human approval. Replaces the current single-card snapshot.
          </p>
          <div className="stub-list">
            Severity scoring · multi-channel response plans · approval queue
          </div>
        </div>
      </Card>

      <Card
        title="Tactical alerts"
        emphasis="cross-dimensional gaps"
        sub="Cube-driven · multi-dim slicing · read-only in P1"
      >
        <div className="stub">
          <h3>Coming with the cube (P1 sprint 2 backend)</h3>
          <p>
            Multi-dimensional gap detection across Room × Country × Window × LOS × Channel ×
            Segment × Stay-month. Surfaces correlated cells with confidence + window-closure.
          </p>
          <div className="stub-list">
            EU × Suite × 30-60d gap · DE pickup spike · Direct mix erosion
          </div>
        </div>
      </Card>

      <Card
        title="Daily revenue"
        emphasis="last 90d"
        sub="Stacked: Rooms · F&B · Spa · Activity"
        source="mv_kpi_daily"
      >
        {d90.length > 0 ? (
          <DailyRevenueChart data={d90} />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mute)' }}>No data.</div>
        )}
      </Card>
    </>
  );
}
