'use client';

// CountPostButton — approve a submitted count and post it to the stock
// ledger via /api/inv/count/post → public.fn_inv_count_post.
// Segregation of duties: the RPC rejects the approval when the approver
// name hashes to the same uuid as counts.counted_by.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  countId: string;
}

export default function CountPostButton({ countId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function approve() {
    if (!name.trim()) { setErr('Enter the approver name'); return; }
    setBusy(true); setErr(null);
    try {
      const resp = await fetch('/api/inv/count/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count_id: countId, approved_by_name: name.trim() }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.ok) { setErr(j.error || `HTTP ${resp.status}`); setBusy(false); return; }
      setOpen(false); setName('');
      router.refresh();
    } catch (e: any) { setErr(e?.message || 'Network error'); }
    finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Approve &amp; post
      </button>
    );
  }

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Approver name"
        className="inv-input"
        style={{ width: 140 }}
      />
      <button type="button" className="btn-primary" onClick={approve} disabled={busy}>
        {busy ? '…' : 'Confirm'}
      </button>
      <button type="button" className="btn-ghost" onClick={() => { setOpen(false); setErr(null); }} disabled={busy}>
        Cancel
      </button>
      {err && <span className="inv-error" style={{ fontSize: 12 }}>{err}</span>}
    </span>
  );
}
