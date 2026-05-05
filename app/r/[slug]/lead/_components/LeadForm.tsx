'use client';

import { useState } from 'react';

export default function LeadForm({ slug }: { slug: string }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ optInRequired: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/lead/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, firstName, country, source: slug }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'capture failed');
      setDone({ optInRequired: !!j.opt_in_required });
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div style={{
        padding: 18, background: 'var(--moss-soft, #5a8c66)', color: 'var(--paper)',
        borderRadius: 4, fontSize: 'var(--t-sm)',
      }}>
        <strong>Subscribed.</strong>{' '}
        {done.optInRequired
          ? 'Check your inbox for a confirmation link (GDPR).'
          : 'You\'re on the list. Next email goes out at the next full moon.'}
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', fontSize: 'var(--t-base)',
    background: 'var(--paper)', border: '1px solid var(--ink-faint)',
    borderRadius: 4, color: 'var(--ink)', fontFamily: 'var(--sans)', marginBottom: 10,
  };

  return (
    <div>
      <input style={inputStyle} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input style={inputStyle} placeholder="First name (optional)" value={firstName} onChange={e => setFirstName(e.target.value)} />
      <input style={inputStyle} placeholder="Country code, e.g. ES, US, FR (optional)" value={country} onChange={e => setCountry(e.target.value.toUpperCase().slice(0, 2))} />
      <button
        onClick={submit}
        disabled={busy || !email}
        style={{
          padding: '12px 24px', background: busy ? 'var(--ink-faint)' : 'var(--moss)',
          color: 'var(--paper)', border: 'none', borderRadius: 4,
          fontSize: 'var(--t-sm)', cursor: busy ? 'wait' : 'pointer',
          textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', fontWeight: 600,
        }}
      >
        {busy ? 'Subscribing…' : 'Subscribe'}
      </button>
      {err && <div style={{ marginTop: 10, fontSize: 'var(--t-sm)', color: 'var(--bad, #b65f4a)' }}>Error: {err}</div>}
    </div>
  );
}
