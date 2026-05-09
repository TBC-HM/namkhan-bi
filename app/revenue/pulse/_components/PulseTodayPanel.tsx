'use client';

// app/revenue/pulse/_components/PulseTodayPanel.tsx
// PBS 2026-05-09: today's bookings + cancellations with hover-detail.
// Server fetches via lib/pulseToday.ts, this component renders both columns.

import { useState } from 'react';
import { fmtUSD } from '@/lib/format';
import type { PulseTodayRow } from '@/lib/pulseToday';

interface Props {
  booked: PulseTodayRow[];
  cancelled: PulseTodayRow[];
  bookedRevenue: number;
  cancelledRevenue: number;
}

export default function PulseTodayPanel({ booked, cancelled, bookedRevenue, cancelledRevenue }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Column
        label="New bookings · today"
        rows={booked}
        revenue={bookedRevenue}
        emptyText="No new reservations recorded today."
        accent="#1a2e21"
        accentText="#7ad790"
      />
      <Column
        label="Cancellations · today"
        rows={cancelled}
        revenue={cancelledRevenue}
        emptyText="No cancellations recorded today."
        accent="#3a1f1c"
        accentText="#ff8a8a"
      />
    </div>
  );
}

function Column({
  label, rows, revenue, emptyText, accent, accentText,
}: {
  label: string;
  rows: PulseTodayRow[];
  revenue: number;
  emptyText: string;
  accent: string;
  accentText: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: '#a8854a',
        }}>{label}</span>
        <span style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11, fontWeight: 700, color: accentText,
          background: accent,
          padding: '2px 8px', borderRadius: 4,
        }}>
          {rows.length} · {fmtUSD(revenue)}
        </span>
      </div>
      {rows.length === 0 ? (
        <div style={{
          padding: '14px 12px',
          color: '#7d7565',
          fontStyle: 'italic',
          fontSize: 13,
          background: '#0a0a0a',
          border: '1px dashed #2a2520',
          borderRadius: 6,
        }}>{emptyText}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((r) => {
            const id = String(r.reservation_id ?? r.booking_id ?? Math.random());
            const isOpen = openId === id;
            return (
              <div
                key={id}
                onClick={() => setOpenId(isOpen ? null : id)}
                style={{
                  cursor: 'pointer',
                  padding: '8px 10px',
                  background: isOpen ? '#15140f' : '#0f0d0a',
                  border: '1px solid #1f1c15',
                  borderRadius: 4,
                  transition: 'background 0.12s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: '#e9e1ce', fontWeight: 600 }}>{r.guest_name ?? '—'}</span>
                  <span style={{ color: accentText, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700 }}>
                    {fmtUSD(Number(r.total_amount ?? 0))}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#9b907a', marginTop: 2 }}>
                  <span>{r.source_name ?? r.source ?? '—'}</span>
                  <span>·</span>
                  <span>{Number(r.nights ?? 0)} night{Number(r.nights ?? 0) === 1 ? '' : 's'}</span>
                  {r.rate_plan && <><span>·</span><span>{r.rate_plan}</span></>}
                </div>
                {isOpen && (
                  <div style={{
                    marginTop: 8, paddingTop: 8, borderTop: '1px solid #1f1c15',
                    fontSize: 11, color: '#9b907a',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 3, columnGap: 12,
                  }}>
                    <span><strong style={{ color: '#d8cca8' }}>Reservation:</strong> {r.reservation_id ?? '—'}</span>
                    <span><strong style={{ color: '#d8cca8' }}>Booking ID:</strong> {r.booking_id ?? '—'}</span>
                    <span><strong style={{ color: '#d8cca8' }}>Status:</strong> {r.status ?? '—'}</span>
                    <span><strong style={{ color: '#d8cca8' }}>Booked:</strong> {r.booking_date ?? '—'}</span>
                    {r.cancellation_date && (
                      <span><strong style={{ color: '#d8cca8' }}>Cancelled:</strong> {r.cancellation_date}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
