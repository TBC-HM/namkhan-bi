'use client';

// ReceiptModal — Page 5 (PO detail) "Record receipt" button per line.
// POSTs to /api/proc/receipt. Schema trigger handles stock balance + last cost.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  poId: string;
  poItemId: number;
  itemName: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCostUsd: number | null;
}

export default function ReceiptModal({ poId, poItemId, itemName, qtyOrdered, qtyReceived, unitCostUsd }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const remaining = Math.max(0, qtyOrdered - qtyReceived);

  async function submit(form: HTMLFormElement) {
    setBusy(true); setErr(null);
    const fd = new FormData(form);
    const body = {
      po_id: poId,
      po_item_id: poItemId,
      received_qty: Number(fd.get('received_qty')),
      unit_cost_usd: Number(fd.get('unit_cost_usd')) || unitCostUsd,
      batch_code: (fd.get('batch_code') as string) || null,
      expiry_date: (fd.get('expiry_date') as string) || null,
      quality_check_passed: fd.get('quality_check_passed') === 'on',
      rejected_qty: Number(fd.get('rejected_qty')) || 0,
      rejection_reason: (fd.get('rejection_reason') as string) || null,
      notes: (fd.get('notes') as string) || null,
    };
    if (!body.received_qty || body.received_qty <= 0) {
      setErr('Received qty must be > 0'); setBusy(false); return;
    }
    try {
      const resp = await fetch('/api/proc/receipt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.ok) { setErr(j.error || `HTTP ${resp.status}`); setBusy(false); return; }
      setOpen(false); router.refresh();
    } catch (e: any) { setErr(e?.message || 'Network error'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)} disabled={remaining === 0}>
        Record receipt
      </button>
      {open && (
        <div className="inv-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal-title">Receive {itemName} <small>{remaining} of {qtyOrdered} remaining</small></h3>
            <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
              <label className="inv-field">
                <span>Quantity received</span>
                <input type="number" name="received_qty" step="0.001" required className="inv-input" max={remaining} />
              </label>
              <label className="inv-field">
                <span>Unit cost USD</span>
                <input type="number" name="unit_cost_usd" step="0.01" className="inv-input" defaultValue={unitCostUsd ?? undefined} />
              </label>
              <label className="inv-field">
                <span>Batch code</span>
                <input type="text" name="batch_code" className="inv-input" placeholder="optional" />
              </label>
              <label className="inv-field">
                <span>Expiry date</span>
                <input type="date" name="expiry_date" className="inv-input" />
              </label>
              <label className="inv-field-inline">
                <input type="checkbox" name="quality_check_passed" defaultChecked />
                <span>Quality check passed</span>
              </label>
              <label className="inv-field">
                <span>Rejected qty (if any)</span>
                <input type="number" name="rejected_qty" step="0.001" className="inv-input" defaultValue={0} />
              </label>
              <label className="inv-field">
                <span>Notes</span>
                <input type="text" name="notes" className="inv-input" />
              </label>
              {err && <div className="inv-error">{err}</div>}
              <div className="inv-actions">
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save receipt'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
