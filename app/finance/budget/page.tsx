// app/finance/budget/page.tsx
// Budget vs actual — stub awaiting budget upload.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';

export const dynamic = 'force-dynamic';

export default function BudgetPage() {
  return (
    <>
      <PanelHero
        eyebrow="Budget · 2026"
        title="Budget"
        emphasis="vs actual"
        sub="Awaiting owner-provided annual budget"
        kpis={
          <>
            <KpiCard label="Annual Target" value={null} greyed kind="money" />
            <KpiCard label="YTD Actual" value={null} greyed kind="money" />
            <KpiCard label="Variance" value={null} greyed kind="pct" />
            <KpiCard label="Pace to Target" value={null} greyed kind="pct" />
          </>
        }
      />

      <Card title="Budget upload" sub="Owner to provide annual budget by USALI line">
        <div className="stub">
          <h3>Coming soon</h3>
          <p>
            Monthly USALI budget · variance vs actual · pace to target.
            Requires owner-provided annual budget split by USALI department and sub-department.
          </p>
          <div className="stub-list">
            CSV upload · USALI mapping · Monthly variance · Pace tracker
          </div>
        </div>
      </Card>
    </>
  );
}
