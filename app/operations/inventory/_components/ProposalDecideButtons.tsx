'use client';

// ProposalDecideButtons — Approve (with SKU) or Reject a catalog proposal.
// POSTs to /api/proc/proposal/decide.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props { proposalId: string; suggestedSku?: string }

export default function ProposalDecideButtons({ proposalId, suggestedSku }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const [sku, setSku] = useState(suggestedSku ?? '');
  const [notes, setNotes] = useState('');

  async function submit(decision: 'approve' | 'reject') {
    setBusy(decision); setErr(null);
    try {
      const body: any = { proposal_id: proposalId, decision };
      if (decision === 'approve') body.sku = sku;
      else                        body.reviewer_notes = notes;
      const resp = await fetch('/api/proc/proposal/decide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.ok) { setErr(j.error || `HTTP ${resp.status}`); setBusy(null); return; }
      setMode(null); setSku(''); setNotes(''); router.refresh();
    } catch (e: any) { setErr(e?.message || 'Network error'); }
    finally { setBusy(null); }
  }

  if (!mode) {
    return (
      <>
        <div className="inv-actions">
          <button type="button" className="btn-primary" onClick={() => setMode('approve')}>Approve</button>
          <button type="button" className="btn-danger"  onClick={() => setMode('reject')}>Reject</button>
        </div>
        {err && <div className="inv-error">{err}</div>}
      </>
    );
  }

  return (
    <div className="inv-inline-form">
      {mode === 'approve' ? (
        <label className="inv-field">
          <span>SKU (required)</span>
          <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="inv-input" placeholder="e.g. FB-GIN-HEND-700" />
        </label>
      ) : (
        <label className="inv-field">
          <span>Rejection reason</span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="inv-input" />
        </label>
      )}
      <div className="inv-actions">
        <button type="button" className="btn-ghost"   onClick={() => setMode(null)}>Cancel</button>
        <button
          type="button"
          className={mode === 'approve' ? 'btn-primary' : 'btn-danger'}
          onClick={() => submit(mode)}
          disabled={!!busy || (mode === 'approve' && !sku.trim())}
        >
          {busy ? '…' : mode === 'approve' ? 'Confirm approve' : 'Confirm reject'}
        </button>
      </div>
      {err && <div className="inv-error">{err}</div>}
    </div>
  );
}
