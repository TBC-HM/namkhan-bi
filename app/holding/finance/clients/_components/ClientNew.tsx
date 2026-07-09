// app/holding/finance/clients/_components/ClientNew.tsx
// PBS 2026-07-09: Quick-add client form (name-only minimum · rest editable later).

'use client';

import { useState, useTransition, type CSSProperties } from 'react';

const HAIRLINE = '#E6DFCC';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const PAPER = '#FFFFFF';
const PRIMARY = '#084838';

export default function ClientNew() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<string>('');
  const [country, setCountry] = useState('');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        const r = await fetch('/api/holding/clients/upsert', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email: email.trim() || null, category: category || null, country: country.trim() || null }),
        });
        if (!r.ok) throw new Error(`create failed (${r.status})`);
        setMsg(`✓ Client "${name.trim()}" added`);
        setName(''); setEmail(''); setCategory(''); setCountry('');
        setTimeout(() => window.location.reload(), 600);
      } catch (e) { setMsg(`✗ ${(e as Error).message}`); }
    });
  };

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'end' }}>
      <div style={{ flex: 2, minWidth: 180 }}>
        <label style={labelStyle}>Client name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Aventura DMC" />
      </div>
      <div style={{ flex: 2, minWidth: 180 }}>
        <label style={labelStyle}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="billing@..." />
      </div>
      <div style={{ flex: 1, minWidth: 120 }}>
        <label style={labelStyle}>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          <option value="">—</option><option value="DMC">DMC</option><option value="Consulting">Consulting</option>
          <option value="Wholesale">Wholesale</option><option value="Partner">Partner</option><option value="Supplier">Supplier</option><option value="Other">Other</option>
        </select>
      </div>
      <div style={{ flex: 1, minWidth: 100 }}>
        <label style={labelStyle}>Country</label>
        <input value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle} placeholder="Spain" />
      </div>
      <button type="button" onClick={submit} disabled={!canSubmit || pending} style={{ ...primaryBtn, opacity: (canSubmit && !pending) ? 1 : 0.5 }}>
        {pending ? '…' : '+ Add client'}
      </button>
      {msg && <div style={{ width: '100%', fontSize: 11, color: msg.startsWith('✓') ? '#1F5C2C' : '#B04A2F' }}>{msg}</div>}
    </div>
  );
}

const labelStyle: CSSProperties = { fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT, fontWeight: 700, display: 'block', marginBottom: 4 };
const inputStyle: CSSProperties = { padding: '5px 8px', border: `1px solid ${HAIRLINE}`, borderRadius: 4, fontSize: 12, background: PAPER, color: INK, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
const primaryBtn: CSSProperties = { padding: '7px 14px', border: `1px solid ${PRIMARY}`, background: PRIMARY, color: PAPER, borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
