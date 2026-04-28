// app/actions/page.tsx
import GreyOut from '@/components/ui/GreyOut';

export default function ActionsPage() {
  return (
    <GreyOut reason="Recommendations engine in development — Phase 4 (Vertex AI)">
      <div className="section">
        <div className="section-head">
          <div className="section-title">Action Plans</div>
          <div className="section-tag">Sorted: critical → opportunity</div>
        </div>
        <div className="kpi-strip cols-4">
          <div className="kpi-tile alert">
            <div className="kpi-label">Critical</div>
            <div className="kpi-value">—</div>
            <div className="kpi-deltas">immediate action</div>
          </div>
          <div className="kpi-tile warn">
            <div className="kpi-label">High</div>
            <div className="kpi-value">—</div>
            <div className="kpi-deltas">this week</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Opportunities</div>
            <div className="kpi-value">—</div>
            <div className="kpi-deltas">revenue upside</div>
          </div>
          <div className="kpi-tile good">
            <div className="kpi-label">Resolved 30d</div>
            <div className="kpi-value">—</div>
            <div className="kpi-deltas">closed actions</div>
          </div>
        </div>
      </div>
    </GreyOut>
  );
}
