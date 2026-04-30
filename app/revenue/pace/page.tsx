// app/revenue/pace/page.tsx
// Revenue · Pace — placeholder shell for Deploy 2.
// Replaces /revenue/demand with 18mo forward + 5-KPI row + risk months.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';

export const dynamic = 'force-dynamic';

export default function PacePage() {
  return (
    <>
      <PanelHero
        eyebrow="Pace · forward 18 months"
        title="Booking"
        emphasis="velocity"
        sub="OTB vs STLY vs Budget · 18mo forward · risk months auto-flagged"
        kpis={
          <>
            <KpiCard label="OTB Roomnights · 12mo fwd" value={null} greyed hint="Deploy 2" />
            <KpiCard label="OTB Revenue" value={null} kind="money" greyed hint="Deploy 2" />
            <KpiCard label="Pickup last 7d" value={null} greyed hint="Deploy 2" />
            <KpiCard label="Pickup last 28d" value={null} greyed hint="Deploy 2" />
          </>
        }
      />

      <Card
        title="Pace by check-in month"
        emphasis="OTB vs STLY · forward 18 months"
        sub="Replaces /revenue/demand · current build truncates at Feb 2027"
      >
        <div className="stub">
          <h3>Coming in Deploy 2</h3>
          <p>
            Full 18-month forward pace table extending the current Demand view. Click a row to
            drill to segment + day-of-week. Sep / Nov risk months auto-flagged by the Pace agent.
          </p>
          <div className="stub-list">
            18mo forward · pickup velocity 7d/28d · segment drilldown · 12mo grouped bars · 4-month overlay
          </div>
        </div>
      </Card>
    </>
  );
}
