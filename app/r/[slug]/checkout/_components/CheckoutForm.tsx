'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CheckoutForm({ slug, totalUsd, maxPax }: { slug: string; totalUsd: number; maxPax: number }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [waiver, setWaiver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          totalUsd,
          partySize,
          guestInfo: { firstName, lastName, email, phone, country },
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'checkout failed');
      router.push(j.checkoutUrl);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setBusy(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 13px', fontSize: 'var(--t-base)',
    background: 'var(--paper)', border: '1px solid var(--ink-faint)',
    borderRadius: 4, color: 'var(--ink)', fontFamily: 'var(--sans)', marginBottom: 10,
  };

  const valid = firstName && lastName && email && waiver;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input style={inputStyle} placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} />
        <input style={inputStyle} placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} />
      </div>
      <input style={inputStyle} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input style={inputStyle} placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} />
        <input style={inputStyle} placeholder="Country code (e.g. ES)" value={country} onChange={e => setCountry(e.target.value.toUpperCase().slice(0, 2))} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>Party size</label>
        <input
          style={inputStyle}
          type="number"
          min={1}
          max={Math.max(1, maxPax)}
          value={partySize}
          onChange={e => setPartySize(Math.max(1, Math.min(maxPax, Number(e.target.value))))}
        />
      </div>
      <label style={{ display: 'flex', gap: 10, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', marginBottom: 18, cursor: 'pointer' }}>
        <input type="checkbox" checked={waiver} onChange={e => setWaiver(e.target.checked)} />
        I agree to the cancellation policy and outdoor-activity waiver.
      </label>
      <button
        onClick={submit}
        disabled={busy || !valid}
        style={{
          width: '100%', padding: '14px 24px',
          background: busy || !valid ? 'var(--ink-faint)' : 'var(--moss)',
          color: 'var(--paper)', border: 'none', borderRadius: 4,
          fontSize: 'var(--t-sm)', cursor: busy ? 'wait' : 'pointer',
          textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', fontWeight: 600,
        }}
      >
        {busy ? 'Processing…' : `Hold booking — pay $${Math.round(totalUsd * 0.30).toLocaleString()} deposit`}
      </button>
      {err && <div style={{ marginTop: 10, fontSize: 'var(--t-sm)', color: 'var(--bad, #b65f4a)' }}>Error: {err}</div>}
    </div>
  );
}
