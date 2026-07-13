'use client';
// app/sales/mails/AddAliasForm.tsx
// Small client form used inside the /sales/mails empty state to seed the
// first shared alias without navigating anywhere. Reloads on success so the
// page re-runs its guards.

import { useState } from 'react';

const T = { WHITE: '#FFFFFF', HAIR: '#E6DFCC', INK: '#1B1B1B', INK_M: '#5A5A5A', FOREST: '#084838', CREAM: '#F5F0E1', RED: '#B03826' };

export default function AddAliasForm() {
  const [addr, setAddr] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#084838');
  const [sortOrder, setSortOrder] = useState<string>('100');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>('');

  const add = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/sales/mails/add-alias', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mailbox_address: addr.trim().toLowerCase(),
          label: label.trim(),
          badge_color: color.trim(),
          sort_order: Number(sortOrder) || 100,
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) { setErr(j.detail ?? j.error ?? 'add failed'); return; }
      location.reload();
    } finally { setBusy(false); }
  };

  const inputStyle: React.CSSProperties = {
    height: 32,
    padding: '0 10px',
    border: '1px solid ' + T.HAIR,
    borderRadius: 4,
    fontSize: 12,
    color: T.INK,
    background: T.WHITE,
    outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="alias@thenamkhan.com" style={inputStyle} />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Booking)" style={inputStyle} />
        <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#084838" style={inputStyle} />
        <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="Sort order" style={inputStyle} />
      </div>
      {err && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4, color: T.RED, fontSize: 12 }}>
          {err}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy || !addr.trim() || !label.trim()}
          style={{
            background: (busy || !addr.trim() || !label.trim()) ? '#8FA69A' : T.FOREST,
            color: T.WHITE, border: 'none', borderRadius: 4, padding: '8px 14px',
            fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
          }}
        >
          Add alias
        </button>
      </div>
    </div>
  );
}
