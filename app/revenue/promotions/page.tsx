// app/revenue/promotions/page.tsx
// Promotions — stub.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';

export const dynamic = 'force-dynamic';

export default function PromotionsPage() {
  return (
    <>
      <PanelHero
        eyebrow="Promotions"
        title="Active"
        emphasis="promotions"
        sub="Phase 2 — effectiveness tracking"
        kpis={
          <>
            <KpiCard label="Active Promos" value={null} greyed />
            <KpiCard label="Bookings 30d" value={null} greyed />
            <KpiCard label="Revenue Lift" value={null} greyed kind="money" />
            <KpiCard label="Cost / Booking" value={null} greyed kind="money" />
          </>
        }
      />

      <Card title="Promotions" emphasis="performance" sub="Promotion performance tracking pending — Phase 2">
        <div className="stub">
          <h3>Coming soon</h3>
          <p>
            Active promo inventory · effectiveness vs uplift cost · auto-stop rules.
            Requires Cloudbeds promotion endpoint integration and a baseline definition.
          </p>
          <div className="stub-list">
            Active list · Uplift attribution · Cost ratio · Auto-pause rules
          </div>
        </div>
      </Card>
    </>
  );
}
