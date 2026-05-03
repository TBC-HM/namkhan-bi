// app/operations/maintenance/_components/PpmCalendar.tsx
// Forward-looking PPM task list (simple Gantt substitute).

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { PpmTaskRow } from '../_data/ppm';

interface Props {
  rows: PpmTaskRow[] | null;
}

const statusColor: Record<PpmTaskRow['status'], string> = {
  scheduled: '#8a8170',
  in_progress: '#1f3d2e',
  completed: '#2f6f4a',
  overdue: '#a02d2d',
};

export default function PpmCalendar({ rows }: Props) {
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
        PPM <em style={{ color: '#a17a4f' }}>calendar</em>
      </h3>

      {!rows || rows.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-M5"
          table="ops.ppm_templates + ops.ppm_tasks"
          reason="Templates per asset class + per-asset task generation pending."
        />
      ) : (
        rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 90px 80px 60px',
              gap: 8,
              fontSize: "var(--t-base)",
              padding: '6px 0',
              borderBottom: '1px dashed #e6dfc9',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600 }}>{r.template_name}</span>
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: "var(--t-sm)",
                color: '#8a8170',
              }}
            >
              {r.asset_code}
            </span>
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: "var(--t-sm)",
                color: '#4a4538',
              }}
            >
              {r.due_date}
            </span>
            <span
              style={{
                fontSize: "var(--t-xs)",
                color: statusColor[r.status],
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                textAlign: 'right',
                fontWeight: 700,
              }}
            >
              {r.status}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
