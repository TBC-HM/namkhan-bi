'use client';

// ProposeNewItemButton — floating button on Shop page that opens a modal
// to submit a new-item proposal. POSTs to /api/proc/proposal.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  categories: { category_id: number; name: string }[];
  units: { unit_id: number; code: string; name: string }[];
  suppliers: { supplier_id: string; name: string }[];
}

export default function ProposeNewItemButton({ categories, units, suppliers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(form: HTMLFormElement) {
    setBusy(true); setErr(null);
    const fd = new FormData(form);
    const body = {
      proposed_name: (fd.get('proposed_name') as string)?.trim(),
      proposed_description: (fd.get('proposed_description') as string) || null,
      category_id: Number(fd.get('category_id')) || null,
      uom_id: Number(fd.get('uom_id')) || null,
      estimated_unit_cost_usd: Number(fd.get('estimated_unit_cost_usd')) || null,
      likely_vendor_id: (fd.get('likely_vendor_id') as string) || null,
      expected_monthly_usage: Number(fd.get('expected_monthly_usage')) || null,
      justification: (fd.get('justification') as string)?.trim(),
    };
    if (!body.proposed_name || !body.justification) {
      setErr('Name + justification are required'); setBusy(false); return;
    }
    try {
      const resp = await fetch('/api/proc/proposal', {
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
      <button type="button" className="inv-propose-fab" onClick={() => setOpen(true)}>
        Can't find what you need? Propose new item →
      </button>
      {open && (
        <div className="inv-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal-title">Propose new product</h3>
            <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
              <label className="inv-field">
                <span>Product name</span>
                <input type="text" name="proposed_name" required className="inv-input" />
              </label>
              <label className="inv-field">
                <span>Description</span>
                <input type="text" name="proposed_description" className="inv-input" placeholder="optional" />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <label className="inv-field" style={{ flex: 1 }}>
                  <span>Category</span>
                  <select name="category_id" className="inv-input">
                    <option value="">—</option>
                    {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="inv-field" style={{ flex: 1 }}>
                  <span>Unit</span>
                  <select name="uom_id" className="inv-input">
                    <option value="">—</option>
                    {units.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.code}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <label className="inv-field" style={{ flex: 1 }}>
                  <span>Est. cost (USD)</span>
                  <input type="number" name="estimated_unit_cost_usd" step="0.01" className="inv-input" />
                </label>
                <label className="inv-field" style={{ flex: 1 }}>
                  <span>Likely vendor</span>
                  <select name="likely_vendor_id" className="inv-input">
                    <option value="">—</option>
                    {suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>)}
                  </select>
                </label>
              </div>
              <label className="inv-field">
                <span>Expected monthly usage</span>
                <input type="number" name="expected_monthly_usage" step="0.01" className="inv-input" placeholder="e.g. 8 bottles/month" />
              </label>
              <label className="inv-field">
                <span>Why we need this</span>
                <textarea name="justification" required className="inv-input" rows={3} />
              </label>
              {err && <div className="inv-error">{err}</div>}
              <div className="inv-actions">
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Submitting…' : 'Submit for catalog approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
