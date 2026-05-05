'use client';

// MovementModal — generic Adjust-count / Move-stock / Mark-write-off modal.
// Mode determines which fields render and what movement_type gets POSTed.
// POSTs to /api/inv/movement.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type MovementMode = 'adjust' | 'move' | 'writeoff';

interface Props {
  itemId: string;
  itemName: string;
  currentLocationId: number | null;
  locations: { location_id: number; location_name: string }[];
}

export default function MovementModal({ itemId, itemName, currentLocationId, locations }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<MovementMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const close = () => { setMode(null); setErr(null); };

  async function submit(form: HTMLFormElement) {
    if (busy || !mode) return;
    setBusy(true); setErr(null);
    const fd = new FormData(form);
    const qty = Number(fd.get('quantity'));
    const fromLoc = Number(fd.get('from_location') || currentLocationId || 0);
    const toLoc   = Number(fd.get('to_location') || 0);
    const reason  = (fd.get('reason') as string) || null;

    let body: any;
    if (mode === 'adjust') {
      body = {
        item_id: itemId,
        location_id: fromLoc,
        movement_type: 'count_correction',
        quantity: qty, // signed delta
        notes: reason,
      };
    } else if (mode === 'writeoff') {
      body = {
        item_id: itemId,
        location_id: fromLoc,
        movement_type: 'write_off',
        quantity: -Math.abs(qty),
        notes: reason,
      };
    } else {
      // move — two rows
      if (!toLoc || toLoc === fromLoc) { setErr('Pick a different to_location'); setBusy(false); return; }
      body = [
        { item_id: itemId, location_id: fromLoc, movement_type: 'transfer_out', quantity: -Math.abs(qty), counterparty_location_id: toLoc, notes: reason },
        { item_id: itemId, location_id: toLoc,   movement_type: 'transfer_in',  quantity: Math.abs(qty),  counterparty_location_id: fromLoc, notes: reason },
      ];
    }

    try {
      const resp = await fetch('/api/inv/movement', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.ok) { setErr(j.error || `HTTP ${resp.status}`); setBusy(false); return; }
      close();
      router.refresh();
    } catch (e: any) { setErr(e?.message || 'Network error'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="inv-actions">
        <button type="button" className="btn-ghost"   onClick={() => setMode('adjust')}>Adjust count</button>
        <button type="button" className="btn-ghost"   onClick={() => setMode('move')}>Move stock</button>
        <button type="button" className="btn-danger"  onClick={() => setMode('writeoff')}>Mark write-off</button>
      </div>

      {mode && (
        <div className="inv-modal-backdrop" onClick={close}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal-title">
              {mode === 'adjust' && 'Adjust count'}
              {mode === 'move' && 'Move stock'}
              {mode === 'writeoff' && 'Mark write-off'}
              <small>{itemName}</small>
            </h3>
            <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
              <label className="inv-field">
                <span>{mode === 'adjust' ? 'Delta (signed: + adds, − removes)' : 'Quantity'}</span>
                <input type="number" name="quantity" step="0.001" required className="inv-input" />
              </label>
              <label className="inv-field">
                <span>{mode === 'move' ? 'From location' : 'Location'}</span>
                <select name="from_location" defaultValue={currentLocationId ?? ''} className="inv-input" required>
                  {!currentLocationId && <option value="">— pick one —</option>}
                  {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
                </select>
              </label>
              {mode === 'move' && (
                <label className="inv-field">
                  <span>To location</span>
                  <select name="to_location" defaultValue="" className="inv-input" required>
                    <option value="">— pick destination —</option>
                    {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
                  </select>
                </label>
              )}
              <label className="inv-field">
                <span>Reason / notes</span>
                <input type="text" name="reason" className="inv-input" placeholder="optional" />
              </label>
              {err && <div className="inv-error">{err}</div>}
              <div className="inv-actions">
                <button type="button" className="btn-ghost" onClick={close} disabled={busy}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
