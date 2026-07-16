'use client';
// components/proposal/PublicProposalClient.tsx
//
// PBS 2026-07-16 (Feature B) — full rewrite of the /p/[token] guest experience.
//
// Design:
//   - Paper-white full-bleed with brand green accents.
//   - Mobile-first responsive (single column under 720px).
//   - Namkhan header · stay summary card · multi-rate offer picker (if 2+)
//     · add-on toggles · live total · guest form · Confirm CTA · footer.
//   - NO credit card capture. Copy says team contacts within 24h.
//   - On success: green "thank you" state with confirmation ID + next steps.
//
// Palette (locked · hardcoded — never `var(--paper-warm)` which is dark on Namkhan):
//   #FFFFFF paper · #F5F0E1 warm · #E6DFCC hairline
//   #1B1B1B ink · #5A5A5A ink-soft · #084838 brand green · #B04A2F red

import { useEffect, useMemo, useState } from 'react';

const T = {
  paper: '#FFFFFF',
  warm: '#F5F0E1',
  hairline: '#E6DFCC',
  ink: '#1B1B1B',
  inkSoft: '#5A5A5A',
  inkMute: '#8A8A8A',
  green: '#084838',
  red: '#B04A2F',
  sans: '-apple-system,"SF Pro Text",Helvetica,Arial,sans-serif',
  serif: 'Georgia,"Times New Roman",serif',
};

const FX_FALLBACK = 21800;

interface Block {
  id: string;
  block_type: string;
  label: string;
  note: string | null;
  qty: number;
  nights: number;
  unit_price_lak: number;
  total_lak: number;
  removable: boolean;
  hero_asset_id: string | null;
  sort_order: number;
  additional_discount_pct: number | null;
}

interface RateOffer {
  id: string;
  rate_plan_id: string;
  position: number;
  label: string | null;
  payment_terms: string | null;
  cancellation_terms: string | null;
  unit_price_lak: number | null;
  total_lak: number | null;
}

interface Props {
  token: string;
  proposal: {
    id: string;
    guest_name: string;
    date_in: string;
    date_out: string;
    status: string;
    fx_lak_per_usd: number | null;
  };
  blocks: Block[];
  rateOffers: RateOffer[];
  inquiry: {
    guest_email: string | null;
    guest_phone: string | null;
    country: string | null;
    adults: number | null;
    children: number | null;
  } | null;
  preselectedRateId: string | null;
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch { return iso; }
}

function fmtUsd(lak: number, fx: number): string {
  const usd = Number(lak) / (fx || FX_FALLBACK);
  return '$' + Math.round(usd).toLocaleString('en-US');
}

function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 1;
  const d1 = new Date(from + 'T00:00:00Z').getTime();
  const d2 = new Date(to + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round((d2 - d1) / 86400000));
}

export default function PublicProposalClient({
  token, proposal, blocks, rateOffers, inquiry, preselectedRateId,
}: Props) {
  const fx = proposal.fx_lak_per_usd ?? FX_FALLBACK;
  const nights = nightsBetween(proposal.date_in, proposal.date_out);

  // Primary room = first sort_order block of type 'room' (or first block if none).
  const primaryBlockId = useMemo(() => {
    const room = blocks.find((b) => b.block_type === 'room');
    return (room ?? blocks[0])?.id ?? null;
  }, [blocks]);

  const addOnBlocks = useMemo(
    () => blocks.filter((b) => b.id !== primaryBlockId),
    [blocks, primaryBlockId],
  );

  const [selectedRateId, setSelectedRateId] = useState<string | null>(() => {
    if (preselectedRateId && rateOffers.some((r) => r.id === preselectedRateId)) return preselectedRateId;
    if (rateOffers.length > 0) return rateOffers[0].id;
    return null;
  });

  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(
    () => new Set(blocks.map((b) => b.id)),
  );

  const [guestName, setGuestName] = useState(proposal.guest_name === 'guest' ? '' : proposal.guest_name);
  const [guestEmail, setGuestEmail] = useState(inquiry?.guest_email ?? '');
  const [guestPhone, setGuestPhone] = useState(inquiry?.guest_phone ?? '');
  const [guestCountry, setGuestCountry] = useState(inquiry?.country ?? '');
  const [arrivalTime, setArrivalTime] = useState('');
  const [guestNotes, setGuestNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Log a page-open event (best-effort). Kept from prior implementation for stats.
  useEffect(() => {
    fetch(`/api/p/${token}/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event_type: 'open' }),
    }).catch(() => {});
  }, [token]);

  // Recompute total live as guest toggles add-ons + switches rate offer.
  const total = useMemo(() => {
    let sum = 0;
    for (const b of blocks) {
      if (b.id === primaryBlockId) {
        // Primary room total driven by selected rate offer (when there are offers).
        if (rateOffers.length >= 2 && selectedRateId) {
          const offer = rateOffers.find((r) => r.id === selectedRateId);
          if (offer?.total_lak != null) { sum += Number(offer.total_lak); continue; }
        }
        sum += Number(b.total_lak ?? 0);
        continue;
      }
      if (selectedBlockIds.has(b.id)) sum += Number(b.total_lak ?? 0);
    }
    return sum;
  }, [blocks, primaryBlockId, rateOffers, selectedRateId, selectedBlockIds]);

  function toggleAddOn(id: string) {
    setSelectedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submitConfirmation(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/public/proposals/${token}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          selected_rate_offer_id: selectedRateId,
          selected_block_ids: Array.from(selectedBlockIds),
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim(),
          guest_phone: guestPhone.trim() || null,
          guest_country: guestCountry.trim() || null,
          arrival_time: arrivalTime.trim() || null,
          guest_notes: guestNotes.trim() || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setConfirmed({ id: j.confirmation_id });
      } else {
        const msg = j?.error === 'rate_limited'
          ? 'Too many attempts from this network in the last hour. Please try again later or email book@thenamkhan.com.'
          : j?.error === 'guest_email_invalid'
            ? 'Please enter a valid email address.'
            : j?.error === 'guest_name_required'
              ? 'Please enter your full name.'
              : j?.error === 'guest_email_required'
                ? 'Please enter your email address.'
                : j?.error === 'proposal_expired'
                  ? 'This proposal has expired. Please contact us to renew.'
                  : 'Something went wrong — please try again in a moment.';
        setError(msg);
      }
    } catch (_e) {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ---- success state ----
  if (confirmed) {
    return (
      <div style={{ minHeight: '100vh', background: T.warm, padding: '48px 20px' }}>
        <div style={{
          maxWidth: 640, margin: '0 auto', background: T.paper,
          border: `1px solid ${T.hairline}`, borderRadius: 10, padding: '48px 32px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex', width: 56, height: 56, borderRadius: '50%',
            background: T.green, color: '#fff', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, marginBottom: 20,
          }}>✓</div>
          <h1 style={{ fontFamily: T.serif, fontSize: 30, color: T.green, margin: 0, lineHeight: 1.15 }}>
            Thank you, {guestName || 'guest'}.
          </h1>
          <p style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 16, lineHeight: 1.6 }}>
            Your booking request is received. Our Reservations team will contact you within 24 hours to secure your reservation and arrange payment.
          </p>
          <div style={{
            marginTop: 24, padding: '14px 16px', background: T.warm,
            border: `1px solid ${T.hairline}`, borderRadius: 6, textAlign: 'left',
            fontSize: 13, color: T.ink, fontFamily: T.sans,
          }}>
            <div style={{ fontSize: 10, color: T.inkSoft, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Your stay</div>
            <div><strong>{fmtDate(proposal.date_in)}</strong> → <strong>{fmtDate(proposal.date_out)}</strong> · {nights} {nights === 1 ? 'night' : 'nights'}</div>
            <div style={{ marginTop: 6 }}>Total: <strong style={{ color: T.green }}>{fmtUsd(total, fx)}</strong></div>
            <div style={{ marginTop: 8, fontSize: 11, color: T.inkSoft, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }}>
              Confirmation ID: {confirmed.id.slice(0, 8)}
            </div>
          </div>
          <p style={{ marginTop: 26, fontSize: 12, color: T.inkSoft }}>
            Questions? <a href="mailto:book@thenamkhan.com" style={{ color: T.green, textDecoration: 'none' }}>book@thenamkhan.com</a>
          </p>
        </div>
      </div>
    );
  }

  const hasMultiRate = rateOffers.length >= 2;
  const canSubmit = guestName.trim().length > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail.trim()) && !submitting;

  // ---- main form state ----
  return (
    <div style={{ minHeight: '100vh', background: T.warm, paddingBottom: 60 }}>
      {/* Header */}
      <header style={{
        background: T.paper,
        borderBottom: `1px solid ${T.hairline}`,
        padding: '28px 24px',
      }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ fontFamily: T.sans, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.inkSoft, marginBottom: 6 }}>
            The Namkhan · Luang Prabang
          </div>
          <h1 style={{ fontFamily: T.serif, fontSize: 32, color: T.green, margin: 0, lineHeight: 1.15 }}>
            Your stay proposal
          </h1>
          <div style={{ fontFamily: T.sans, fontSize: 14, color: T.inkSoft, marginTop: 6 }}>
            For {proposal.guest_name || 'guest'}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '24px 20px' }}>
        {/* Stay summary card */}
        <section style={{
          background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 8,
          padding: '18px 20px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 10, color: T.inkSoft, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: T.sans }}>Your stay</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: T.inkSoft, fontFamily: T.sans }}>Check-in</div>
              <div style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2 }}>{fmtDate(proposal.date_in)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.inkSoft, fontFamily: T.sans }}>Check-out</div>
              <div style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2 }}>{fmtDate(proposal.date_out)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.inkSoft, fontFamily: T.sans }}>Nights</div>
              <div style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2 }}>{nights}</div>
            </div>
            {inquiry?.adults != null && (
              <div>
                <div style={{ fontSize: 11, color: T.inkSoft, fontFamily: T.sans }}>Party</div>
                <div style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2 }}>
                  {inquiry.adults} {inquiry.adults === 1 ? 'adult' : 'adults'}
                  {inquiry.children ? `, ${inquiry.children} ${inquiry.children === 1 ? 'child' : 'children'}` : ''}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Multi-rate offers */}
        {hasMultiRate && (
          <section style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: T.inkSoft, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 4px 10px', fontFamily: T.sans }}>
              Choose your rate
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(220px,1fr))`, gap: 12 }}>
              {rateOffers.map((o) => {
                const selected = selectedRateId === o.id;
                const totalUsd = o.total_lak != null ? fmtUsd(Number(o.total_lak), fx) : '';
                const nightlyUsd = o.unit_price_lak != null ? fmtUsd(Number(o.unit_price_lak), fx) : '';
                return (
                  <label
                    key={o.id}
                    style={{
                      display: 'block', cursor: 'pointer',
                      background: T.paper,
                      border: `2px solid ${selected ? T.green : T.hairline}`,
                      borderRadius: 8, padding: 14,
                      transition: 'border-color 120ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <input
                        type="radio"
                        name="rate_offer"
                        checked={selected}
                        onChange={() => setSelectedRateId(o.id)}
                        style={{ marginTop: 3 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, color: T.inkSoft, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 2 }}>
                          Offer {o.position}
                        </div>
                        <div style={{ fontFamily: T.serif, fontSize: 15, color: T.ink, lineHeight: 1.25 }}>
                          {o.label ?? `Rate ${o.position}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ paddingLeft: 22, fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>
                      {nightlyUsd && <div>{nightlyUsd} / night</div>}
                      {totalUsd && <div style={{ fontSize: 15, fontWeight: 600, color: T.green, marginTop: 4 }}>{totalUsd} <span style={{ fontSize: 10, fontWeight: 400, color: T.inkSoft, letterSpacing: '0.08em', textTransform: 'uppercase' }}>total</span></div>}
                    </div>
                    <div style={{ paddingLeft: 22, marginTop: 8, fontSize: 11, color: T.ink, lineHeight: 1.5 }}>
                      <div style={{ fontSize: 9, color: T.inkSoft, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Payment</div>
                      <div>{o.payment_terms ?? 'Pay at property'}</div>
                      <div style={{ marginTop: 4, fontSize: 9, color: T.inkSoft, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cancellation</div>
                      <div>{o.cancellation_terms ?? 'Free cancellation until 7 days before arrival'}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {/* Add-ons */}
        {addOnBlocks.length > 0 && (
          <section style={{
            background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 8,
            padding: '16px 20px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 10, color: T.inkSoft, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12, fontFamily: T.sans }}>
              Add-ons — uncheck any you don&apos;t want
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {addOnBlocks.map((b) => {
                const checked = selectedBlockIds.has(b.id);
                return (
                  <label key={b.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                    background: checked ? '#F8F5EA' : T.paper,
                    border: `1px solid ${checked ? T.hairline : 'transparent'}`,
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAddOn(b.id)}
                      style={{ marginTop: 4 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, fontWeight: 500 }}>
                        {b.label}
                      </div>
                      {b.note && (
                        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2, lineHeight: 1.4 }}>
                          {b.note}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: T.inkMute, marginTop: 3, fontFamily: T.sans }}>
                        {b.qty} × {b.nights} {b.nights === 1 ? 'night' : 'nights'}
                      </div>
                    </div>
                    <div style={{
                      fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: checked ? T.green : T.inkMute,
                      fontVariantNumeric: 'tabular-nums', minWidth: 68, textAlign: 'right',
                    }}>
                      {fmtUsd(Number(b.total_lak), fx)}
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {/* Live total */}
        <section style={{
          background: T.paper, border: `2px solid ${T.green}`, borderRadius: 8,
          padding: '16px 20px', marginBottom: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <span style={{ fontSize: 11, color: T.inkSoft, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: T.sans }}>Your total</span>
          <span style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 600, color: T.green, fontVariantNumeric: 'tabular-nums' }}>
            {fmtUsd(total, fx)}
          </span>
        </section>

        {/* Guest form */}
        <form onSubmit={submitConfirmation} style={{
          background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 8,
          padding: '20px 22px',
        }}>
          <div style={{ fontSize: 10, color: T.inkSoft, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14, fontFamily: T.sans }}>
            Your details
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            <label style={{ display: 'block' }}>
              <span style={LABEL}>Full name *</span>
              <input required value={guestName} onChange={(e) => setGuestName(e.target.value)} style={INPUT} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={LABEL}>Email *</span>
              <input required type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} style={INPUT} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={LABEL}>Phone (with country code)</span>
              <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="+..." style={INPUT} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={LABEL}>Country</span>
              <input value={guestCountry} onChange={(e) => setGuestCountry(e.target.value)} style={INPUT} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={LABEL}>Arrival time (approximate)</span>
              <input value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} placeholder="e.g. afternoon flight ~15:30" style={INPUT} />
            </label>
          </div>

          <label style={{ display: 'block', marginTop: 12 }}>
            <span style={LABEL}>Notes for our team (optional)</span>
            <textarea
              value={guestNotes}
              onChange={(e) => setGuestNotes(e.target.value)}
              rows={3}
              placeholder="Dietary preferences, celebrations, special requests..."
              style={{ ...INPUT, minHeight: 78, resize: 'vertical' as const, fontFamily: T.sans }}
            />
          </label>

          {error && (
            <div style={{
              marginTop: 14, padding: '10px 12px', borderRadius: 6,
              background: '#FDECE4', border: `1px solid ${T.red}`, color: T.red,
              fontSize: 13, fontFamily: T.sans,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              display: 'block', width: '100%', marginTop: 20,
              padding: '16px 20px', borderRadius: 6, border: 'none',
              background: canSubmit ? T.green : T.inkMute,
              color: '#fff', fontFamily: T.sans, fontSize: 15, fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              letterSpacing: '0.02em',
              transition: 'background 120ms',
            }}
          >
            {submitting ? 'Submitting…' : 'Confirm my booking →'}
          </button>

          <p style={{
            marginTop: 12, fontSize: 12, color: T.inkSoft, textAlign: 'center',
            fontFamily: T.sans, lineHeight: 1.5,
          }}>
            To secure your booking, our Reservations team will contact you within 24 hours to arrange payment.
          </p>
        </form>

        {/* Footer */}
        <footer style={{ marginTop: 32, textAlign: 'center', color: T.inkSoft, fontFamily: T.sans, fontSize: 12, lineHeight: 1.6 }}>
          <div style={{ fontFamily: T.serif, fontSize: 14, color: T.ink, marginBottom: 4 }}>
            The Namkhan · Luang Prabang
          </div>
          <div>
            <a href="mailto:book@thenamkhan.com" style={{ color: T.green, textDecoration: 'none' }}>book@thenamkhan.com</a>
            {' · '}
            <a href="https://thenamkhan.com" style={{ color: T.green, textDecoration: 'none' }}>thenamkhan.com</a>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: T.inkMute, fontStyle: 'italic' }}>
            All prices include 10% Lao VAT and 10% service charge.
          </div>
        </footer>
      </main>
    </div>
  );
}

const LABEL = {
  display: 'block' as const,
  fontSize: 10,
  color: T.inkSoft,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  marginBottom: 5,
  fontFamily: T.sans,
};

const INPUT = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  border: `1px solid ${T.hairline}`,
  borderRadius: 6,
  background: T.paper,
  color: T.ink,
  fontFamily: T.sans,
  boxSizing: 'border-box' as const,
};
