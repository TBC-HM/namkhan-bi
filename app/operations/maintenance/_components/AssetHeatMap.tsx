// app/operations/maintenance/_components/AssetHeatMap.tsx
// Asset health heat-map — colored cells per asset by category × location.

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { AssetHealthCell, AssetHealth } from '../_data/assets';

interface Props {
  cells: AssetHealthCell[] | null;
}

const healthBg: Record<AssetHealth, string> = {
  green: '#e6f0ea',
  amber: '#fdf6e7',
  red: '#fee2e2',
};
const healthBd: Record<AssetHealth, string> = {
  green: '#bfddc5',
  amber: '#f3d57a',
  red: '#fca5a5',
};

export default function AssetHeatMap({ cells }: Props) {
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
          fontSize: 16,
          fontWeight: 500,
          margin: '0 0 8px',
        }}
      >
        Asset <em style={{ color: '#a17a4f' }}>health heat-map</em>
      </h3>

      {!cells || cells.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-M2"
          table="ops.assets · 142 assets census required"
          reason="One-time manual census needed to seed the asset registry. Without it, MTBF, last-intervention, and predicted-failure cannot render."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 4,
            marginTop: 6,
          }}
        >
          {cells.map((c) => (
            <div
              key={c.asset_code}
              title={`${c.category} · ${c.location} · ${c.health}${
                c.mtbf_days ? ` · MTBF ${c.mtbf_days}d` : ''
              }`}
              style={{
                background: healthBg[c.health],
                border: `1px solid ${healthBd[c.health]}`,
                borderRadius: 4,
                padding: 6,
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: 10,
                minHeight: 50,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontWeight: 700 }}>{c.asset_code}</div>
              <div style={{ color: '#8a8170', fontSize: 9 }}>{c.location}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
