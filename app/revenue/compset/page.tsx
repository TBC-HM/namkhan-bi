// app/revenue/compset/page.tsx
// Comp set — stub.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';

export const dynamic = 'force-dynamic';

export default function CompSetPage() {
  return (
    <>
      <PanelHero
        eyebrow="Competitive set"
        title="Comp set"
        emphasis="parity"
        sub="Phase 2 — daily scrape integration"
        kpis={
          <>
            <KpiCard label="Comp Index" value={null} greyed hint="vs comp set median" />
            <KpiCard label="Rate Position" value={null} greyed hint="rank 1–5" />
            <KpiCard label="Avg Comp BAR" value={null} greyed hint="last 30d" />
            <KpiCard label="Parity Breaches" value={null} greyed hint="OTA vs direct" />
          </>
        }
      />

      <Card title="Comp set" emphasis="rate parity" sub="Comp set scraping integration scheduled for Phase 2">
        <div className="stub">
          <h3>Coming soon</h3>
          <p>
            Daily rate scrape across 5 competitive properties. Rank position, parity breaches,
            and demand-aligned pricing recommendations land in Phase 2.
          </p>
          <div className="stub-list">
            Demand alignment · Rate position · Parity breaches · Forecast lift
          </div>
        </div>
      </Card>
    </>
  );
}
