'use client';

// PrDecideButtons — Approve / Send back / Reject for a PR.
// Owner-role hard-coded under the password-gated dashboard.
// POSTs to /api/proc/decide.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props { prId: string }

export default function PrDecideButtons({ prId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showReason, setShowReason] = useState<'send_back' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');

  async function decide(decision: 'approve' | 'send_back' | 'reject', n?: string) {
    setBusy(decision); setErr(null);
    try {
      const resp = await fetch('/api/proc/decide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pr_id: prId, decision, notes: n ?? null }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.ok) { setErr(j.error || `HTTP ${resp.status}`); setBusy(null); return; }
      setShowReason(null); setNotes(''); router.refresh();
    } catch (e: any) { setErr(e?.message || 'Network error'); }
    finally { setBusy(null); }
  }

  return (
    <>
      <div className="inv-actions">
        <button type="button" className="btn-primary" onClick={() => decide('approve')} disabled={!!busy}>
          {busy === 'approve' ? '…' : 'Approve'}
        </button>
        <button type="button" className="btn-ghost"   onClick={() => setShowReason('send_back')} disabled={!!busy}>Send back</button>
        <button type="button" className="btn-danger"  onClick={() => setShowReason('reject')} disabled={!!busy}>Reject</button>
      </div>
      {showReason && (
        <div className="inv-inline-form">
          <label className="inv-field">
            <span>{showReason === 'send_back' ? 'What more do you need?' : 'Reason for rejection'}</span>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="inv-input" />
          </label>
          <div className="inv-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowReason(null); setNotes(''); }}>Cancel</button>
            <button
              type="button"
              className={showReason === 'send_back' ? 'btn-ghost' : 'btn-danger'}
              onClick={() => decide(showReason, notes || undefined)}
              disabled={!!busy}
            >
              Confirm {showReason === 'send_back' ? 'send back' : 'reject'}
            </button>
          </div>
        </div>
      )}
      {err && <div className="inv-error">{err}</div>}
    </>
  );
}
