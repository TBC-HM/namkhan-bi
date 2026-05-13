// app/operations/maintenance/_components/TicketQueue.tsx

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { MaintenanceTicketRow, TicketPriority } from '../_data/tickets';

interface Props {
  rows: MaintenanceTicketRow[] | null;
}

const priorityColor: Record<TicketPriority, string> = {
  urgent: 'var(--oxblood)',
  corrective: '#a87024',
  cosmetic: '#8a8170',
};

export default function TicketQueue({ rows }: Props) {
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
        Ticket <em style={{ color: '#a17a4f' }}>queue</em>
      </h3>

      {!rows || rows.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-M1"
          table="ops.maintenance_tickets"
          reason="Table exists empty per arch doc. Cloudbeds room.note.created bridge + staff intake form pending."
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 90px 70px',
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
            <span>Priority</span>
            <span>Title</span>
            <span style={{ textAlign: 'right' }}>SLA</span>
            <span style={{ textAlign: 'right' }}>Source</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '90px 1fr 90px 70px',
                gap: 8,
                fontSize: "var(--t-base)",
                padding: '7px 0',
                borderBottom: '1px dashed #e6dfc9',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: "var(--t-sm)",
                  color: priorityColor[r.priority],
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {r.priority}
              </span>
              <span>
                <span style={{ fontWeight: 600 }}>{r.title}</span>
                {(r.asset || r.room_no) && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: "var(--t-sm)",
                      color: '#8a8170',
                      fontFamily: 'ui-monospace, Menlo, monospace',
                    }}
                  >
                    {r.asset || r.room_no}
                  </span>
                )}
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                  fontSize: "var(--t-sm)",
                  color:
                    r.hours_to_sla_breach !== null && r.hours_to_sla_breach !== undefined
                      ? r.hours_to_sla_breach < 4
                        ? 'var(--oxblood)'
                        : r.hours_to_sla_breach < 24
                        ? '#a87024'
                        : '#2f6f4a'
                      : '#8a8170',
                }}
              >
                {r.hours_to_sla_breach !== null && r.hours_to_sla_breach !== undefined
                  ? `${r.hours_to_sla_breach}h`
                  : '—'}
              </span>
              <span
                style={{
                  fontSize: "var(--t-xs)",
                  color: '#8a8170',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  textAlign: 'right',
                }}
              >
                {r.source}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
