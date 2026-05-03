// app/operations/maintenance/_components/VendorScorecard.tsx
// Full-width vendor scorecard table (90-day window).

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { VendorScorecardRow } from '../_data/vendors';

interface Props {
  rows: VendorScorecardRow[] | null;
}

const ratingColor: Record<VendorScorecardRow['rating'], string> = {
  A: '#2f6f4a',
  B: '#1f3d2e',
  C: '#a87024',
  D: '#a02d2d',
};

export default function VendorScorecard({ rows }: Props) {
  return (
    <div
      style={{
        background: 'var(--paper-warm)',
        border: '1px solid #e6dfc9',
        borderRadius: 8,
        padding: '14px 16px',
        marginTop: 12,
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--serif)',
          fontSize: "var(--t-xl)",
          fontWeight: 500,
          margin: '0 0 8px',
        }}
      >
        Vendor <em style={{ color: '#a17a4f' }}>scorecard · 90d</em>
      </h3>

      {!rows || rows.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-M7"
          table="ops.vendors + ops.v_vendor_scorecard_90d"
          reason="Vendor allow-list curation by GM is a prerequisite. Once seeded, view derives from M1 ticket history."
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 70px 90px 90px 70px 50px',
              gap: 8,
              fontSize: "var(--t-xs)",
              color: '#8a8170',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
              borderBottom: '1px solid #e6dfc9',
              paddingBottom: 6,
            }}
          >
            <span>Vendor</span>
            <span>Category</span>
            <span style={{ textAlign: 'right' }}>Jobs</span>
            <span style={{ textAlign: 'right' }}>On-time</span>
            <span style={{ textAlign: 'right' }}>Avg cost</span>
            <span style={{ textAlign: 'right' }}>Rework</span>
            <span style={{ textAlign: 'right' }}>Rate</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.vendor}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 70px 90px 90px 70px 50px',
                gap: 8,
                fontSize: "var(--t-base)",
                padding: '7px 0',
                borderBottom: '1px dashed #e6dfc9',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600 }}>{r.vendor}</span>
              <span style={{ fontSize: "var(--t-sm)", color: '#8a8170' }}>{r.category}</span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                }}
              >
                {r.jobs_90d}
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                  color: r.on_time_pct < 80 ? '#a02d2d' : '#1c1c1a',
                }}
              >
                {r.on_time_pct}%
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                }}
              >
                ${r.avg_cost.toLocaleString()}
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                  color: r.rework_pct > 10 ? '#a02d2d' : '#1c1c1a',
                }}
              >
                {r.rework_pct}%
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                  fontWeight: 700,
                  color: ratingColor[r.rating],
                }}
              >
                {r.rating}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
