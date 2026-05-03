// app/operations/maintenance/_components/EnergyDash.tsx
// Energy + water trend strip with weather-norm flag.

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { EnergyReadingRow } from '../_data/energy';

interface Props {
  rows: EnergyReadingRow[] | null;
}

export default function EnergyDash({ rows }: Props) {
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
        Energy &amp; <em style={{ color: '#a17a4f' }}>water</em>
      </h3>

      {!rows || rows.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-M4"
          table="ops.energy_meters + ops.energy_readings + weather_norm"
          reason="Manual v0 entry pending — IoT meter rollout planned later. Weather-normalisation requires daily open-meteo fetch per allowlist."
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 60px',
              gap: 6,
              fontSize: "var(--t-xs)",
              color: '#8a8170',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
              borderBottom: '1px solid #e6dfc9',
              paddingBottom: 6,
            }}
          >
            <span>Date</span>
            <span style={{ textAlign: 'right' }}>kWh/occ</span>
            <span style={{ textAlign: 'right' }}>m³/occ</span>
            <span style={{ textAlign: 'right' }}>flag</span>
          </div>
          {rows.slice(0, 7).map((r) => (
            <div
              key={r.date}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 60px',
                gap: 6,
                fontSize: "var(--t-sm)",
                padding: '5px 0',
                borderBottom: '1px dashed #e6dfc9',
                alignItems: 'center',
              }}
            >
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {r.date}
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                }}
              >
                {r.kwh_per_occ_rm.toFixed(1)}
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                }}
              >
                {r.m3_per_occ_rm.toFixed(2)}
              </span>
              <span
                style={{
                  fontSize: "var(--t-xs)",
                  color: r.anomaly_flag ? '#a02d2d' : '#8a8170',
                  textAlign: 'right',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {r.anomaly_flag ? 'anom' : '·'}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
