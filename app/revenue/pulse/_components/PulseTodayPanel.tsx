'use client';

// app/revenue/pulse/_components/PulseTodayPanel.tsx
// PBS 2026-05-09: today's bookings + cancellations with full reservation
// detail on hover. Server fetches via lib/pulseToday.ts; this component
// renders both columns as data-rows with the 6 PBS-mandated fields visible
// on the row (source · roomnights · rate · total · rate_plan · guest_name)
// and the full reservation row revealed on click via inline expansion.

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
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: 'var(--brass)',
        }}>{label}</span>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          fontWeight: 700,
          color: accentText,
          background: accent,
          padding: '2px 8px',
          borderRadius: 4,
        }}>
          {rows.length} · {fmtUSD(revenue)}
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={{
          padding: '14px 12px',
          color: 'var(--ink-mute)',
          fontStyle: 'italic',
          fontSize: 'var(--t-sm)',
          background: '#0a0a0a',
          border: '1px dashed #2a2520',
          borderRadius: 6,
        }}>{emptyText}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Column header — locks the 6 PBS fields visible on every row. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1.2fr 0.6fr 0.7fr 0.7fr 1fr',
            gap: 8,
            padding: '4px 10px',
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)',
            color: 'var(--ink-mute)',
            textTransform: 'uppercase',
          }}>
            <span>Guest</span>
            <span>Source</span>
            <span style={{ textAlign: 'right' }}>RN</span>
            <span style={{ textAlign: 'right' }}>Rate</span>
            <span style={{ textAlign: 'right' }}>Total</span>
            <span>Rate plan</span>
          </div>

          {rows.map((r) => {
            const id = String(r.reservation_id ?? r.booking_id ?? Math.random());
            const isOpen = openId === id;
            const nights = Number(r.nights ?? 0);
            const total = Number(r.total_amount ?? 0);
            // Per-night rate (ADR for this reservation). PBS asked for "rate"
            // alongside total — the natural per-night view.
            const rate = nights > 0 ? total / nights : 0;
            const tooltip = [
              `${r.guest_name ?? '—'} · ${r.source_name ?? r.source ?? '—'}`,
              `${nights} night${nights === 1 ? '' : 's'} · ${fmtUSD(rate)}/night · ${fmtUSD(total)} total`,
              `Rate plan: ${r.rate_plan ?? '—'}`,
              `Reservation ${r.reservation_id ?? '—'} · ${r.status ?? '—'}`,
              r.cancellation_date ? `Cancelled: ${String(r.cancellation_date).slice(0, 16)}` : `Booked: ${String(r.booking_date ?? '—').slice(0, 16)}`,
            ].join('\n');
            return (
              <div
                key={id}
                onClick={() => setOpenId(isOpen ? null : id)}
                title={tooltip}
                style={{
                  cursor: 'pointer',
                  padding: '8px 10px',
                  background: isOpen ? '#15140f' : '#0f0d0a',
                  border: '1px solid #1f1c15',
                  borderRadius: 4,
                  transition: 'background 0.12s ease',
                }}
              >
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1.2fr 0.6fr 0.7fr 0.7fr 1fr',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 'var(--t-sm)',
                }}>
                  <span style={{ color: 'var(--ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.guest_name ?? '—'}
                  </span>
                  <span style={{ color: '#9b907a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.source_name ?? r.source ?? '—'}
                  </span>
                  <span style={{ color: 'var(--line-soft)', fontFamily: 'var(--mono)', textAlign: 'right' }}>
                    {nights || '—'}
                  </span>
                  <span style={{ color: '#9b907a', fontFamily: 'var(--mono)', textAlign: 'right' }}>
                    {nights > 0 ? fmtUSD(rate) : '—'}
                  </span>
                  <span style={{ color: accentText, fontFamily: 'var(--mono)', fontWeight: 700, textAlign: 'right' }}>
                    {fmtUSD(total)}
                  </span>
                  <span style={{ color: '#9b907a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.rate_plan ?? '—'}
                  </span>
                </div>

                {isOpen && (
                  <div style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px solid #1f1c15',
                    fontSize: 'var(--t-xs)',
                    color: '#9b907a',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    rowGap: 3,
                    columnGap: 12,
                  }}>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Reservation:</strong> {r.reservation_id ?? '—'}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Booking ID:</strong> {r.booking_id ?? '—'}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Status:</strong> {r.status ?? '—'}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Booked:</strong> {r.booking_date ? String(r.booking_date).slice(0, 16) : '—'}</span>
                    {r.cancellation_date && (
                      <span><strong style={{ color: 'var(--line-soft)' }}>Cancelled:</strong> {String(r.cancellation_date).slice(0, 16)}</span>
                    )}
                    <span><strong style={{ color: 'var(--line-soft)' }}>Source:</strong> {r.source_name ?? r.source ?? '—'}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Rate plan:</strong> {r.rate_plan ?? '—'}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Nights:</strong> {nights || '—'}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Per-night rate:</strong> {nights > 0 ? fmtUSD(rate) : '—'}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Total:</strong> {fmtUSD(total)}</span>
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
