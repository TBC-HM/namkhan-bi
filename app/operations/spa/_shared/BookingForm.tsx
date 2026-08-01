'use client';
// app/operations/spa/_shared/BookingForm.tsx
// Spa module v1 — create-booking form (brief spa-module-v1, gap 2).
// Treatment picker auto-fills duration + price from the catalogue; therapist
// and room optional (fn_spa_create_booking accepts NULL and stays conflict-safe
// on whatever is assigned). POSTs /api/spa/bookings, then router.refresh().

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

export interface BookingFormOption { id: string; label: string; }
export interface BookingFormTreatment {
  treatment_id: number; name: string;
  duration_min: number | null; price_usd: number | null;
}

const inp: React.CSSProperties = {
  padding: '7px 9px', fontSize: 13, borderRadius: 4, width: '100%',
  border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised, color: TOKENS.ink,
};
const lbl: React.CSSProperties = {
  fontFamily: MONO, fontSize: 10, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: TOKENS.inkSoft, marginBottom: 3, display: 'block',
};

export default function BookingForm({
  propertyId, dayIso, treatments, therapists, rooms,
}: {
  propertyId: number;
  dayIso: string;
  treatments: BookingFormTreatment[];
  therapists: BookingFormOption[];
  rooms: BookingFormOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [guest, setGuest] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [resId, setResId] = useState('');
  const [treatmentId, setTreatmentId] = useState('');
  const [therapistId, setTherapistId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState(dayIso);
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  const pickTreatment = (id: string) => {
    setTreatmentId(id);
    const t = treatments.find((x) => String(x.treatment_id) === id);
    if (t) {
      if (t.duration_min != null) setDuration(String(t.duration_min));
      if (t.price_usd != null) setPrice(String(t.price_usd));
    }
  };

  const submit = async () => {
    setErr(null);
    if (!guest.trim()) { setErr('Guest name is required.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      setErr('Date and time are required.'); return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/spa/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          // Local wall-clock; the server treats it in the property TZ context
          // used across the module (bookings render via localTimeStr).
          scheduled_at: `${date}T${time}:00${propertyId === 1000001 ? '+02:00' : '+07:00'}`,
          duration_min: duration || null,
          guest_name: guest.trim(),
          catalogue_treatment_id: treatmentId || null,
          therapist_id: therapistId || null,
          room_id: roomId || null,
          reservation_id: resId.trim() || null,
          guest_email: guestEmail.trim() || null,
          guest_phone: guestPhone.trim() || null,
          price: price || null,
          currency: 'USD',
          notes: notes.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(
          /SPA_CONFLICT_THERAPIST/.test(j.error ?? '') ? 'Therapist is already booked in that window.'
          : /SPA_CONFLICT_ROOM/.test(j.error ?? '') ? 'Room is occupied in that window (incl. cleanup buffer).'
          : (j.error ?? 'Failed to create booking.'),
        );
        return;
      }
      setOpen(false);
      setGuest(''); setResId(''); setNotes(''); setGuestEmail(''); setGuestPhone('');
      router.refresh();
    } catch {
      setErr('Network error — booking not created.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '7px 14px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em',
          textTransform: 'uppercase', borderRadius: 4, border: 'none', cursor: 'pointer',
          background: TOKENS.forest, color: TOKENS.bgRaised, fontWeight: 600,
        }}
      >
        + New booking
      </button>
    );
  }

  return (
    <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 6, background: TOKENS.bgRaised, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <div>
          <span style={lbl}>Guest name *</span>
          <input style={inp} value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="Guest name" />
        </div>
        <div>
          <span style={lbl}>Reservation (in-house)</span>
          <input style={inp} value={resId} onChange={(e) => setResId(e.target.value)} placeholder="Cloudbeds res. ID — optional" />
        </div>
        <div>
          <span style={lbl}>Guest email</span>
          <input style={inp} type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="for confirmations — optional" />
        </div>
        <div>
          <span style={lbl}>Guest phone (WhatsApp)</span>
          <input style={inp} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="+856… — optional" />
        </div>
        <div>
          <span style={lbl}>Treatment</span>
          <select style={inp} value={treatmentId} onChange={(e) => pickTreatment(e.target.value)}>
            <option value="">— select —</option>
            {treatments.map((t) => (
              <option key={t.treatment_id} value={String(t.treatment_id)}>
                {t.name}{t.price_usd != null ? ` · $${t.price_usd}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span style={lbl}>Therapist</span>
          <select style={inp} value={therapistId} onChange={(e) => setTherapistId(e.target.value)}>
            <option value="">— unassigned —</option>
            {therapists.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <span style={lbl}>Room</span>
          <select style={inp} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">— unassigned —</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <span style={lbl}>Date</span>
          <input style={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <span style={lbl}>Time (local)</span>
          <input style={inp} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <span style={lbl}>Duration (min)</span>
          <input style={inp} type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60" />
        </div>
        <div>
          <span style={lbl}>Price (USD)</span>
          <input style={inp} type="number" min={0} step={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="auto from treatment" />
        </div>
      </div>
      <div>
        <span style={lbl}>Notes</span>
        <input style={inp} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferences, contraindications — optional" />
      </div>
      {err && (
        <div style={{ fontSize: 12, color: TOKENS.terracotta, fontFamily: MONO }}>{err}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={submit}
          disabled={busy}
          style={{
            padding: '7px 16px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em',
            textTransform: 'uppercase', borderRadius: 4, border: 'none',
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            background: TOKENS.forest, color: TOKENS.bgRaised, fontWeight: 600,
          }}
        >
          {busy ? 'Saving…' : 'Create booking'}
        </button>
        <button
          onClick={() => { setOpen(false); setErr(null); }}
          disabled={busy}
          style={{
            padding: '7px 14px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em',
            textTransform: 'uppercase', borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised, color: TOKENS.ink,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
