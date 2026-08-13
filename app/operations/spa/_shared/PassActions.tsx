'use client';
// app/operations/spa/_shared/PassActions.tsx
// Spa module v1 — pass sale + redemption client actions (brief
// spa-module-v1-slice-day-pass-tiers). SellPassForm POSTs /api/spa/passes with
// tier_id; tier-based pricing prefills credits/price/validity. RedeemActions
// PATCHes { action: 'redeem' } (optionally tied to one of today's bookings) or
// cancels an active pass. SPA_PASS_* errors surface as friendly text.

import { useState, useEffect } from 'react';
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
  if (/SPA_PASS_TIER_NOT_FOUND/.test(msg)) return 'Tier not found.';
  if (/SPA_PASS_TIER_INACTIVE/.test(msg)) return 'Tier is no longer active.';
  return msg || 'Something went wrong.';
}

export interface PassBookingOption { id: string; label: string; }
export interface PassTier {
  tier_id: number;
  code: string;
  name: string;
  pass_type: string;
  credits_total: number;
  price: number;
  currency: string;
  valid_days: number;
}

export function SellPassForm({ propertyId, todayIso }: { propertyId: number; todayIso: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tiers, setTiers] = useState<PassTier[]>([]);
  const [tierId, setTierId] = useState<number | null>(null);
  const [passType, setPassType] = useState<'day_pass' | 'package'>('day_pass');
  const [name, setName] = useState('');
  const [guest, setGuest] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [credits, setCredits] = useState('1');
  const [validFrom, setValidFrom] = useState(todayIso);
  const [validUntil, setValidUntil] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && tiers.length === 0) {
      fetch(`/api/spa/tiers?property_id=${propertyId}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.ok && j.tiers) setTiers(j.tiers);
        })
        .catch(() => {});
    }
  }, [open, propertyId, tiers.length]);

  useEffect(() => {
    if (tierId) {
      const tier = tiers.find((t) => t.tier_id === tierId);
      if (tier) {
        setName(tier.name);
        setPassType(tier.pass_type as 'day_pass' | 'package');
        setCredits(String(tier.credits_total));
        setPrice(String(tier.price));
        setCurrency(tier.currency);
        const vf = new Date(validFrom);
        const vu = new Date(vf.getTime() + tier.valid_days * 86400000);
        setValidUntil(vu.toISOString().slice(0, 10));
      }
    }
  }, [tierId, tiers, validFrom]);

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
          tier_id: tierId,
          pass_type: passType,
          name: name.trim(),
          guest_name: guest.trim(),
          guest_email: guestEmail.trim() || null,
          guest_phone: guestPhone.trim() || null,
          credits_total: credits || 1,
          valid_from: validFrom || null,
          valid_until: validUntil || null,
          price: price || null,
          currency: currency,
          notes: notes.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(friendly(j.error ?? '')); return; }
      setOpen(false);
      setTierId(null);
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

  const filteredTiers = tiers.filter((t) => t.pass_type === passType);

  return (
    <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 6, padding: 14, background: TOKENS.bgRaised, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <div>
          <label style={lbl}>Type</label>
          <select style={inp} value={passType} onChange={(e) => { setPassType(e.target.value === 'package' ? 'package' : 'day_pass'); setTierId(null); }}>
            <option value="day_pass">Day pass</option>
            <option value="package">Package</option>
          </select>
        </div>
        {filteredTiers.length > 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Tier (optional)</label>
            <select style={inp} value={tierId ?? ''} onChange={(e) => setTierId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Custom (enter manually) —</option>
              {filteredTiers.map((t) => (
                <option key={t.tier_id} value={t.tier_id}>
                  {t.name} · {t.credits_total} credits · {t.currency === 'EUR' ? '€' : t.currency === 'LAK' ? '₭' : '$'}{t.price}
                </option>
              ))}
            </select>
          </div>
        )}
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
          <label style={lbl}>Price ({currency})</label>
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
          <input style={inp} type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lbl}>Notes</label>
          <textarea style={{ ...inp, minHeight: 60, fontFamily: 'inherit' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes (price overrides recorded automatically)" />
        </div>
      </div>
      {err && <div style={{ fontSize: 12, color: TOKENS.terracotta, fontFamily: MONO }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btn} onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Sell pass'}</button>
        <button style={btnGhost} onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}

export function RedeemActions({
  pass,
  bookingOptions,
}: {
  pass: { pass_id: string; name: string; credits_remaining: number; status: string };
  bookingOptions: PassBookingOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [credits, setCredits] = useState('1');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const redeem = async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/spa/passes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'redeem',
          pass_id: pass.pass_id,
          credits: credits || 1,
          booking_id: bookingId,
          note: note.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(friendly(j.error ?? '')); return; }
      setShow(false);
      setCredits('1');
      setBookingId(null);
      setNote('');
      router.refresh();
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm(`Cancel pass "${pass.name}"? This cannot be undone.`)) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/spa/passes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', pass_id: pass.pass_id }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(friendly(j.error ?? '')); return; }
      router.refresh();
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  };

  if (pass.status !== 'active') {
    return (
      <div style={{ fontSize: 11, fontFamily: MONO, color: TOKENS.inkSoft }}>—</div>
    );
  }

  if (!show) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          style={{ ...btn, padding: '5px 10px', fontSize: 10 }}
          onClick={() => setShow(true)}
        >
          Redeem
        </button>
        <button
          style={{ ...btnGhost, padding: '5px 10px', fontSize: 10 }}
          onClick={cancel}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 4, padding: 8, background: TOKENS.bgRaised, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 280 }}>
      <div>
        <label style={lbl}>Credits to redeem</label>
        <input style={inp} type="number" min={1} max={pass.credits_remaining} value={credits} onChange={(e) => setCredits(e.target.value)} />
      </div>
      {bookingOptions.length > 0 && (
        <div>
          <label style={lbl}>Link to booking (optional)</label>
          <select style={inp} value={bookingId ?? ''} onChange={(e) => setBookingId(e.target.value || null)}>
            <option value="">— standalone redemption —</option>
            {bookingOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label style={lbl}>Note</label>
        <input style={inp} value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
      </div>
      {err && <div style={{ fontSize: 11, color: TOKENS.terracotta, fontFamily: MONO }}>{err}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ ...btn, padding: '5px 10px', fontSize: 10 }} onClick={redeem} disabled={busy}>
          {busy ? 'Saving…' : 'Confirm'}
        </button>
        <button style={{ ...btnGhost, padding: '5px 10px', fontSize: 10 }} onClick={() => setShow(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
