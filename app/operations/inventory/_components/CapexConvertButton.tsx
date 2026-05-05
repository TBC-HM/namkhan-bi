'use client';

// CapexConvertButton — Page 8 capex card "Convert to fixed asset".
// POSTs to /api/fa/capex/convert.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  capexId: string;
  capexTitle: string;
  estimatedCostUsd: number;
}

export default function CapexConvertButton({ capexId, capexTitle, estimatedCostUsd }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(form: HTMLFormElement) {
    setBusy(true); setErr(null);
    const fd = new FormData(form);
    const body = {
      capex_id: capexId,
      asset_tag: (fd.get('asset_tag') as string)?.trim(),
      serial_number: (fd.get('serial_number') as string) || null,
      manufacturer:  (fd.get('manufacturer')  as string) || null,
      model:         (fd.get('model')         as string) || null,
      in_service_date: (fd.get('in_service_date') as string) || null,
      location:      (fd.get('location')      as string) || null,
      insurance_value_usd: Number(fd.get('insurance_value_usd')) || null,
      warranty_expiry: (fd.get('warranty_expiry') as string) || null,
      gl_account_code: (fd.get('gl_account_code') as string) || null,
    };
    if (!body.asset_tag) { setErr('Asset tag is required'); setBusy(false); return; }
    try {
      const resp = await fetch('/api/fa/capex/convert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.ok) { setErr(j.error || `HTTP ${resp.status}`); setBusy(false); return; }
      setOpen(false); router.push(`/operations/inventory/assets/${j.asset_id}`);
    } catch (e: any) { setErr(e?.message || 'Network error'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>Convert to fixed asset →</button>
      {open && (
        <div className="inv-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="inv-modal-title">Convert to fixed asset <small>{capexTitle} · ${estimatedCostUsd.toFixed(0)}</small></h3>
            <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
              <label className="inv-field">
                <span>Asset tag</span>
                <input type="text" name="asset_tag" required className="inv-input" placeholder="e.g. FA-SOL-001" />
              </label>
              <label className="inv-field">
                <span>Serial number</span>
                <input type="text" name="serial_number" className="inv-input" />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <label className="inv-field" style={{ flex: 1 }}>
                  <span>Manufacturer</span>
                  <input type="text" name="manufacturer" className="inv-input" />
                </label>
                <label className="inv-field" style={{ flex: 1 }}>
                  <span>Model</span>
                  <input type="text" name="model" className="inv-input" />
                </label>
              </div>
              <label className="inv-field">
                <span>In-service date</span>
                <input type="date" name="in_service_date" className="inv-input" defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label className="inv-field">
                <span>Location</span>
                <input type="text" name="location" className="inv-input" placeholder="e.g. Plant room" />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <label className="inv-field" style={{ flex: 1 }}>
                  <span>Insurance value USD</span>
                  <input type="number" name="insurance_value_usd" step="0.01" className="inv-input" />
                </label>
                <label className="inv-field" style={{ flex: 1 }}>
                  <span>Warranty until</span>
                  <input type="date" name="warranty_expiry" className="inv-input" />
                </label>
              </div>
              <label className="inv-field">
                <span>GL account code</span>
                <input type="text" name="gl_account_code" className="inv-input" placeholder="optional" />
              </label>
              {err && <div className="inv-error">{err}</div>}
              <div className="inv-actions">
                <button type="button" className="btn-ghost"   onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create asset'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
