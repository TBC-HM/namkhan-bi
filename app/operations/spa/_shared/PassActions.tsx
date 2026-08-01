'use client';
// app/operations/spa/_shared/PassActions.tsx
// Spa module v1 — pass sale + redemption client actions (brief spa-module-v1,
// gap 6). SellPassForm POSTs /api/spa/passes; RedeemActions PATCHes
// { action: 'redeem' } (optionally tied to one of today's bookings) or
// cancels an active pass. SPA_PASS_* errors surface as friendly text.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

const inp: React.CSSProperties = {
  padding: '7px 9px', fontSize: 13, borderRadius: 4, width: '100%',
  border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised, color: TOKENS.ink,
};
const lbl: React.CSSProperties = {
  fontFamily: MONO, fontSize: 10, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: TOKENS.inkSoft, marginBottom: 3, display: 'block',
};
const btn: React.CSSProperties = {
  padding: '7px 14px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.05em',
  textTransform: 'uppercase', borderRadius: 4, cursor: 'pointer',
  border: `1px solid ${TOKENS.forest}`, background: TOKENS.forest, color: TOKENS.bgRaised,
};
const btnGhost: React.CSSProperties = {
  ...btn, background: 'transparent', color: TOKENS.ink, border: `1px solid ${TOKENS.border}`,
};

function friendly(msg: string): string {
  if (/SPA_PASS_NO_CREDITS/.test(msg)) return 'Not enough credits left on this pass.';
  if (/SPA_PASS_EXPIRED/.test(msg)) return 'This pass has expired.';
  if (/SPA_PASS_INACTIVE/.test(msg)) return 'This pass is no longer active.';
  if (/SPA_PASS_NOT_STARTED/.test(msg)) return 'This pass is not valid yet.';
  if (/SPA_PASS_BOOKING_MISMATCH/.test(msg)) return 'That booking does not belong to this property.';
  if (/SPA_PASS_BAD_DATES/.test(msg)) return 'Valid-until must be after valid-from.';
  return msg || 'Something went wrong.';
}

export interface PassBookingOption { id: string; label: string; }

export function SellPassForm({ propertyId, todayIso }: { propertyId: number; todayIso: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [passType, setPassType] = useState<'day_pass' | 'package'>('day_pass');
  const [name, setName] = useState('');
  const [guest, setGuest] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [credits, setCredits] = useState('1');
  const [validFrom, setValidFrom] = useState(todayIso);
  const [validUntil, setValidUntil] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !guest.trim()) { setErr('Pass name and guest name are required.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/spa/passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          pass_type: passType,
          name: name.trim(),
          guest_name: guest.trim(),
          guest_email: guestEmail.trim() || null,
          guest_phone: guestPhone.trim() || null,
          credits_total: credits || 1,
          valid_from: validFrom || null,
          valid_until: validUntil || null,
          price: price || null,
          currency: 'USD',
          notes: notes.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(friendly(j.error ?? '')); return; }
      setOpen(false);
      setName(''); setGuest(''); setGuestEmail(''); setGuestPhone(''); setCredits('1'); setPrice(''); setNotes(''); setValidUntil('');
      router.refresh();
    } catch {
      setErr('Network error — pass not created.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return <button style={btn} onClick={() => setOpen(true)}>+ Sell pass</button>;
  }
  return (
    <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 6, padding: 14, background: TOKENS.bgRaised, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <div>
          <label style={lbl}>Type</label>
          <select style={inp} value={passType} onChange={(e) => setPassType(e.target.value === 'package' ? 'package' : 'day_pass')}>
            <option value="day_pass">Day pass</option>
            <option value="package">Package</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Pass name *</label>
          <input style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder={passType === 'day_pass' ? 'Spa Day Pass' : '3-Treatment Package'} />
        </div>
        <div>
          <label style={lbl}>Guest name *</label>
          <input style={inp} value={guest} onChange={(e) => setGuest(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Credits</label>
          <input style={inp} type="number" min={1} value={credits} onChange={(e) => setCredits(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Price (USD)</label>
          <input style={inp} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="entered at sale" />
        </div>
        <div>
          <label style={lbl}>Valid from</label>
          <input style={inp} type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Valid until</label>
          <input style={inp} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Guest email</label>
          <input style={inp} type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Guest phone</label>
          <input style={inp} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="+856 20 ..." />
        </div>
        <div>
          <label style={lbl}>Notes</label>
          <input style={inp} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {err && <div style={{ color: TOKENS.terracotta, fontSize: 12 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btn} disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Sell pass'}</button>
        <button style={btnGhost} disabled={busy} onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>
  );
}

export function RedeemActions({ passId, status, creditsRemaining, bookings }: {
  passId: string;
  status: string;
  creditsRemaining: number;
  bookings: PassBookingOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState('');

  if (status !== 'active') return null;

  const fire = async (payload: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/spa/passes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) { setErr(friendly(j.error ?? '')); return; }
      setOpen(false); setBookingId('');
      router.refresh();
    } catch {
      setErr('Network error.');
    } finally {
      setBusy(false);
    }
  };

  const small: React.CSSProperties = { ...btnGhost, padding: '4px 9px', fontSize: 10 };
  if (!open) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ ...small, borderColor: TOKENS.forest, color: TOKENS.forest }} disabled={busy || creditsRemaining < 1} onClick={() => setOpen(true)}>Redeem</button>
        <button style={{ ...small, color: TOKENS.terracotta, borderColor: TOKENS.terracotta }} disabled={busy} onClick={() => fire({ action: 'cancel', pass_id: passId })}>Cancel</button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
      <select style={{ ...inp, padding: '5px 7px', fontSize: 12 }} value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
        <option value="">No linked booking</option>
        {bookings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>
      {err && <div style={{ color: TOKENS.terracotta, fontSize: 11 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ ...small, borderColor: TOKENS.forest, color: TOKENS.forest }} disabled={busy}
          onClick={() => fire({ action: 'redeem', pass_id: passId, booking_id: bookingId || null, credits: 1 })}>
          {busy ? '…' : 'Redeem 1 credit'}
        </button>
        <button style={small} disabled={busy} onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>
  );
}
