'use client';

// app/sales/b2b/_components/UploadContractButton.tsx
// Adds a "+ Upload contract" button on /sales/b2b. Click opens an inline modal
// with a form that POSTs to /api/sales/dmc/contract with optional PDF.

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadContractButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const resp = await fetch('/api/sales/dmc/contract', { method: 'POST', body: fd });
      const json: any = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        setError(json?.error ?? `HTTP ${resp.status}`);
        setBusy(false);
        return;
      }
      // Success — close + refresh table
      setOpen(false);
      formRef.current?.reset();
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        style={{
          background: '#1f5f3a',
          color: 'var(--paper-warm)',
          border: 'none',
          padding: '8px 14px',
          borderRadius: 4,
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.02em',
        }}
      >
        + Upload contract
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            zIndex: 1000,
            paddingTop: 60,
          }}
        >
          <form
            ref={formRef}
            onSubmit={onSubmit}
            style={{
              background: 'var(--paper-warm)',
              borderRadius: 8,
              width: 'min(720px, 92vw)',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: 24,
              border: '1px solid #e6dfc9',
              fontSize: 13,
              color: '#4a4538',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 22 }}>
                New <em style={{ color: '#a17a4f' }}>contract</em>
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 22, color: '#8a8170', cursor: 'pointer' }}
              >×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Partner short name *" required>
                <input name="partner_short_name" required style={inp} placeholder="e.g. Asian Trails" />
              </Field>
              <Field label="Legal name">
                <input name="partner_legal_name" style={inp} placeholder="e.g. Asian Trails Co. Ltd." />
              </Field>
              <Field label="Type">
                <select name="partner_type" defaultValue="DMC" style={inp}>
                  <option value="DMC">DMC</option>
                  <option value="TO">Tour Operator</option>
                  <option value="OTA">OTA</option>
                </select>
              </Field>
              <Field label="Status">
                <select name="status" defaultValue="active" style={inp}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="expiring">Expiring</option>
                  <option value="expired">Expired</option>
                  <option value="suspended">Suspended</option>
                </select>
              </Field>
              <Field label="Country">
                <input name="country" style={inp} placeholder="Thailand" />
              </Field>
              <Field label="Flag emoji">
                <input name="country_flag" style={inp} placeholder="🇹🇭" maxLength={4} />
              </Field>
              <Field label="VAT number">
                <input name="vat_number" style={inp} />
              </Field>
              <Field label="Address">
                <input name="address" style={inp} placeholder="Bangkok, Thailand" />
              </Field>
              <Field label="Contact name">
                <input name="contact_name" style={inp} />
              </Field>
              <Field label="Contact role">
                <input name="contact_role" style={inp} placeholder="Sales Director" />
              </Field>
              <Field label="Contact email">
                <input name="contact_email" type="email" style={inp} />
              </Field>
              <Field label="Contact phone">
                <input name="contact_phone" style={inp} />
              </Field>
              <Field label="Effective date">
                <input name="effective_date" type="date" style={inp} />
              </Field>
              <Field label="Expiry date">
                <input name="expiry_date" type="date" style={inp} />
              </Field>
              <Field label="Signed date">
                <input name="signed_date" type="date" style={inp} />
              </Field>
              <Field label="Auto-renew">
                <select name="auto_renew" defaultValue="false" style={inp}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
              <Field label="Pricing model">
                <input name="pricing_model" defaultValue="standard" style={inp} placeholder="standard / net_rate / commission" />
              </Field>
              <Field label="Group surcharge %">
                <input name="group_surcharge_pct" type="number" step="0.01" style={inp} />
              </Field>
              <Field label="Group threshold (rooms)">
                <input name="group_threshold" type="number" min={0} style={inp} />
              </Field>
              <Field label="Extra bed (USD)">
                <input name="extra_bed_usd" type="number" step="0.01" style={inp} />
              </Field>
            </div>

            <div style={{ marginTop: 16 }}>
              <Field label="Notes">
                <textarea name="notes" rows={2} style={{ ...inp, resize: 'vertical' }} />
              </Field>
            </div>

            <div style={{ marginTop: 16, padding: 14, background: '#f9f5e8', border: '1px solid #e6dfc9', borderRadius: 4 }}>
              <Field label="Contract PDF (optional · max 25 MB)">
                <input name="pdf" type="file" accept="application/pdf" style={{ fontSize: 12 }} />
              </Field>
              <div style={{ fontSize: 10.5, color: '#8a8170', marginTop: 6 }}>
                Stored in <code>documents-confidential/dmc/&lt;contract_id&gt;/</code>. Owner-only access.
              </div>
            </div>

            {error && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: '#f7d9d9', border: '1px solid #e2a8a8', color: '#7a1f1f', borderRadius: 4, fontSize: 12 }}>
                <strong>Error:</strong> {error}
                {/SUPABASE_SERVICE_ROLE_KEY/.test(error) && (
                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    Add this env var in Vercel → namkhan-bi → Settings → Environment Variables, then redeploy.
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: '1px solid #e6dfc9', padding: '8px 14px', borderRadius: 4, fontSize: 12.5, cursor: 'pointer', color: '#4a4538' }}
              >Cancel</button>
              <button
                type="submit"
                disabled={busy}
                style={{ background: '#1f5f3a', color: 'var(--paper-warm)', border: 'none', padding: '8px 18px', borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'Saving…' : 'Save contract'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const inp: React.CSSProperties = {
  width: '100%',
  fontSize: 12.5,
  padding: '7px 10px',
  border: '1px solid #e6dfc9',
  borderRadius: 4,
  background: 'var(--paper-warm)',
  fontFamily: 'inherit',
  color: '#4a4538',
};

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.2, color: '#8a8170', marginBottom: 4, fontWeight: 600 }}>
        {label}
      </div>
      {children}
    </div>
  );
}
