'use client';

// ParEditor — "Set par" modal on the item-detail Par-by-location card.
// Upserts inv.par_levels via POST /api/inv/par (UNIQUE item_id, location_id).
// Pattern-match: MovementModal (same modal/backdrop/field classes).
// Brief autospec-inventory_module §5.7.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ParRow {
  location_id: number;
  par_quantity: number;
}

interface Props {
  itemId: string;
  itemName: string;
  locations: { location_id: number; location_name: string }[];
  existingPars: ParRow[];
}

export default function ParEditor({ itemId, itemName, locations, existingPars }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<number | ''>('');

  const close = () => { setOpen(false); setErr(null); setLocationId(''); };

  const existingFor = (locId: number | ''): number | null => {
    if (locId === '') return null;
    const hit = existingPars.find((p) => p.location_id === locId);
    return hit ? Number(hit.par_quantity) : null;
  };

  async function submit(form: HTMLFormElement) {
    if (busy) return;
    setBusy(true); setErr(null);
    const fd = new FormData(form);
    const locId = Number(fd.get('location_id'));
    const parQty = Number(fd.get('par_quantity'));
    const minRaw = fd.get('min_quantity') as string;
    const maxRaw = fd.get('max_quantity') as string;
    const notes = ((fd.get('notes') as string) || '').trim();

    const body = {
      item_id: itemId,
      location_id: locId,
      par_quantity: parQty,
      min_quantity: minRaw === '' ? null : Number(minRaw),
      max_quantity: maxRaw === '' ? null : Number(maxRaw),
      notes: notes || null,
    };

    try {
      const resp = await fetch('/api/inv/par', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.ok) { setErr(j.error || `HTTP ${resp.status}`); setBusy(false); return; }
      close();
      router.refresh();
    } catch (e: any) { setErr(e?.message || 'Network error'); }
    finally { setBusy(false); }
  }

  const currentPar = existingFor(locationId);

  return (
    <>
      <div className="inv-actions">
        <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>Set par</button>
      </div>

      {open && (
        <div className="inv-modal-backdrop" onClick={close}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal-title">
              Set par level
              <small>{itemName}</small>
            </h3>
            <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
              <label className="inv-field">
                <span>Location</span>
                <select
                  name="location_id"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="inv-input"
                  required
                >
                  <option value="">— pick one —</option>
                  {locations.map((l) => (
                    <option key={l.location_id} value={l.location_id}>{l.location_name}</option>
                  ))}
                </select>
              </label>
              <label className="inv-field">
                <span>Par quantity{currentPar != null ? ` (current: ${currentPar})` : ''}</span>
                <input type="number" name="par_quantity" step="0.001" min="0" required className="inv-input" />
              </label>
              <label className="inv-field">
                <span>Reorder threshold (min qty, optional)</span>
                <input type="number" name="min_quantity" step="0.001" min="0" className="inv-input" placeholder="optional" />
              </label>
              <label className="inv-field">
                <span>Max quantity (optional)</span>
                <input type="number" name="max_quantity" step="0.001" min="0" className="inv-input" placeholder="optional" />
              </label>
              <label className="inv-field">
                <span>Notes</span>
                <input type="text" name="notes" className="inv-input" placeholder="optional" />
              </label>
              {err && <div className="inv-error">{err}</div>}
              <div className="inv-actions">
                <button type="button" className="btn-ghost" onClick={close} disabled={busy}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save par'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
