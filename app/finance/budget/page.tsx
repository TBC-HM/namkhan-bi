// app/finance/budget/page.tsx
import GreyOut from '@/components/ui/GreyOut';

export default function BudgetPage() {
  return (
    <GreyOut reason="Budget upload schema pending — owner to provide annual budget">
      <div className="section">
        <div className="section-head">
          <div className="section-title">Budget vs Actual</div>
          <div className="section-tag">Monthly · YTD</div>
        </div>
        <div className="kpi-strip cols-4">
          <div className="kpi-tile">
            <div className="kpi-label">Annual Target</div>
            <div className="kpi-value">—</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">YTD Actual</div>
            <div className="kpi-value">—</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Variance</div>
            <div className="kpi-value">—</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Pace to Target</div>
            <div className="kpi-value">—</div>
          </div>
        </div>
      </div>
    </GreyOut>
  );
}
