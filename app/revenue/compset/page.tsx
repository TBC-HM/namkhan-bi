// app/revenue/compset/page.tsx
import GreyOut from '@/components/ui/GreyOut';

export default function CompSetPage() {
  return (
    <GreyOut reason="Comp set scraping integration scheduled for Phase 2">
      <div className="section">
        <div className="section-head">
          <div className="section-title">Competitive Set</div>
          <div className="section-tag">Rate parity · 5 properties · daily scrape</div>
        </div>
        <div className="kpi-strip cols-4">
          <div className="kpi-tile">
            <div className="kpi-label">Comp Index</div>
            <div className="kpi-value">—</div>
            <div className="kpi-deltas">vs comp set median</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Rate Position</div>
            <div className="kpi-value">—</div>
            <div className="kpi-deltas">rank 1 (lowest) → 5 (highest)</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Avg Comp BAR</div>
            <div className="kpi-value">—</div>
            <div className="kpi-deltas">last 30d avg</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Parity Breaches</div>
            <div className="kpi-value">—</div>
            <div className="kpi-deltas">OTA vs direct</div>
          </div>
        </div>
      </div>
    </GreyOut>
  );
}
