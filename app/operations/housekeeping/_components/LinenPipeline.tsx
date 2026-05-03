// app/operations/housekeeping/_components/LinenPipeline.tsx
// Linen par bars per item with target-90% threshold colouring.

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { LinenParRow } from '../_data/linenPars';

interface Props {
  rows: LinenParRow[] | null;
}

export default function LinenPipeline({ rows }: Props) {
  return (
    <div
      style={{
        background: 'var(--paper-warm)',
        border: '1px solid #e6dfc9',
        borderRadius: 8,
        padding: '14px 16px',
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
        Linen <em style={{ color: '#a17a4f' }}>pipeline</em>
      </h3>

      {!rows || rows.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-H3"
          table="ops.linen_pars + ops.laundry_cycle"
          reason="Daily par counts + laundry cycle hours not yet captured. Bars rendered dashed-only without source."
        />
      ) : (
        rows.map((r) => {
          const tone =
            r.par_pct < 70 ? 'bad' : r.par_pct < 85 ? 'warn' : 'ok';
          const fill =
            tone === 'bad' ? '#a02d2d' : tone === 'warn' ? '#a87024' : '#2f6f4a';
          return (
            <div
              key={r.item}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 70px 1fr 60px',
                gap: 8,
                fontSize: "var(--t-base)",
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: '1px dashed #e6dfc9',
              }}
            >
              <span style={{ fontWeight: 600 }}>{r.item}</span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                  color: fill,
                }}
              >
                {r.par_pct}%
              </span>
              <div
                style={{
                  height: 10,
                  borderRadius: 3,
                  background: '#e0d6b3',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(r.par_pct, 100)}%`,
                    height: '100%',
                    background: fill,
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: "var(--t-xs)",
                  color: '#8a8170',
                  textAlign: 'right',
                }}
              >
                {r.cycle_hours}h
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
