'use client';
// app/operations/spa/_shared/StatusActions.tsx
// Spa module v1 — lifecycle action buttons per booking (brief spa-module-v1,
// gap 2). Transitions whitelist mirrors fn_spa_set_booking_status:
// booked → confirmed → arrived → in_treatment → completed | cancelled | no_show.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TOKENS, MONO } from '@/app/holding/it/cockpit/_components/tokens';

const NEXT_ACTIONS: Record<string, Array<{ to: string; label: string; danger?: boolean }>> = {
  booked: [
    { to: 'confirmed', label: 'Confirm' },
    { to: 'cancelled', label: 'Cancel', danger: true },
    { to: 'no_show', label: 'No-show', danger: true },
  ],
  confirmed: [
    { to: 'arrived', label: 'Arrived' },
    { to: 'cancelled', label: 'Cancel', danger: true },
    { to: 'no_show', label: 'No-show', danger: true },
  ],
  arrived: [
    { to: 'in_treatment', label: 'Start' },
    { to: 'cancelled', label: 'Cancel', danger: true },
  ],
  in_treatment: [
    { to: 'completed', label: 'Complete' },
  ],
};

export default function StatusActions({ bookingId, status }: { bookingId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const actions = NEXT_ACTIONS[status] ?? [];
  if (actions.length === 0) return null;

  const fire = async (to: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/spa/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, status: to }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {actions.map((a) => (
        <button
          key={a.to}
          onClick={() => fire(a.to)}
          disabled={busy}
          style={{
            padding: '3px 8px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.03em',
            textTransform: 'uppercase', borderRadius: 3,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
            border: `1px solid ${a.danger ? TOKENS.terracotta : TOKENS.border}`,
            background: a.danger ? 'transparent' : TOKENS.forest,
            color: a.danger ? TOKENS.terracotta : TOKENS.bgRaised,
          }}
        >
          {a.label}
        </button>
      ))}
    </span>
  );
}
