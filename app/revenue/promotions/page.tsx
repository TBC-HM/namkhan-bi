// app/revenue/promotions/page.tsx
import GreyOut from '@/components/ui/GreyOut';

export default function PromotionsPage() {
  return (
    <GreyOut reason="Promotion performance tracking pending — Phase 2">
      <div className="section">
        <div className="section-head">
          <div className="section-title">Active Promotions</div>
          <div className="section-tag">Effectiveness vs uplift cost</div>
        </div>
        <div className="kpi-strip cols-3">
          <div className="kpi-tile">
            <div className="kpi-label">Active Promos</div>
            <div className="kpi-value">—</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Bookings 30d</div>
            <div className="kpi-value">—</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Revenue Lift</div>
            <div className="kpi-value">—</div>
          </div>
        </div>
      </div>
    </GreyOut>
  );
}
