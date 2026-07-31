'use client';
// app/operations/spa/_shared/NotifyActions.tsx
// Spa module v1 — confirmation/reminder actions per booking (gap 5).
// Calls /api/spa/bookings/notify. Email goes out server-side when possible;
// the WhatsApp deep link always comes back and opens in a new tab so the
// operator sends from their own device (live wa.me pattern).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TOKENS, MONO } from '@/app/holding/it/cockpit/_components/tokens';

export default function NotifyActions({
  bookingId, status, confirmationSentAt,
}: { bookingId: string; status: string; confirmationSentAt: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Confirmations/reminders only make sense pre-delivery.
  if (!['booked', 'confirmed', 'arrived'].includes(status)) return null;

  const kind = confirmationSentAt ? 'reminder' : 'confirmation';

  const fire = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/spa/bookings/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, kind }),
      });
      const j = await res.json();
      if (!res.ok) { setNote(j.error ?? 'failed'); return; }
      if (j.mode === 'email') {
        setNote('emailed ✓');
        router.refresh();
      } else if (j.wa_link) {
        window.open(j.wa_link, '_blank', 'noopener');
        setNote('via WhatsApp →');
      }
    } catch {
      setNote('network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <button
        onClick={fire}
        disabled={busy}
        title="Emails the guest when an address is on file; otherwise opens WhatsApp with the message prefilled."
        style={{
          padding: '3px 8px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.03em',
          textTransform: 'uppercase', borderRadius: 3,
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
          border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised, color: TOKENS.ink,
        }}
      >
        {busy ? '…' : kind === 'reminder' ? '↻ Remind' : '✉ Confirm'}
      </button>
      {note && <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.inkSoft }}>{note}</span>}
    </span>
  );
}
