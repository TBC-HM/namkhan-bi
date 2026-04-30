// app/revenue/pricing/page.tsx
// Revenue · Pricing — placeholder shell for Deploy 2.
// Merges /revenue/rates + /revenue/inventory. BAR calendar heatmap + parity. No "Avg BAR" KPI.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';

export const dynamic = 'force-dynamic';

export default function PricingPage() {
  return (
    <>
      <PanelHero
        eyebrow="Pricing · BAR + parity"
        title="Rate"
        emphasis="calendar"
        sub="Merges /rates + /inventory · heatmap by date, no time-averaged rates"
        kpis={
          <>
            <KpiCard label="Active restrictions · 30d" value={null} greyed hint="Deploy 2" />
            <KpiCard label="Parity breaches · 7d" value={null} greyed hint="Deploy 2" />
            <KpiCard label="BAR floor breaches" value={null} greyed hint="Deploy 2" />
            <KpiCard label="Open override proposals" value={null} greyed hint="Deploy 2" />
          </>
        }
      />

      <Card
        title="BAR calendar"
        emphasis="next 4 weeks"
        sub="Cell shows rate × occ × pickup · click to propose override · human approval gated"
      >
        <div className="stub">
          <h3>Coming in Deploy 2</h3>
          <p>
            Per-room-type heatmap calendar replacing the current Rates view. Restriction list
            filtered to actual restrictions only (current Inventory shows 557 padded room×rate-plan
            combos). Parity check table per room type.
          </p>
          <div className="stub-list">
            BAR heatmap · click-to-propose override · restrictions list · parity check 7d ahead
          </div>
        </div>
      </Card>
    </>
  );
}
