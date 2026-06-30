'use client';

// app/revenue/channels/[source]/_components/DmcContractEditPanel.tsx
//
// Inline read/edit view of governance.dmc_contracts for a channel landing.
// PBS 2026-06-30: Edit happens here directly. No redirect to /settings.
// - Read mode: identical chrome to the server-rendered view.
// - Edit mode: form fields for every editable column. Save → POST to
//   /api/dmc/contract/[id]/update → on success router.refresh().
// PBS 2026-06-30 (2):
//   - "B2B" action button surfaced alongside Preview/No-PDF + Edit.
//   - Renewal cell upgraded: shows signed date + valid-until, calls out
//     "EXPIRED — no rate agreement" loudly when past expiry.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/app/(cockpit)/_design';
import type { DmcContract } from '@/lib/dmc';

interface Props {
  contract: DmcContract;
}

export default function DmcContractEditPanel({ contract: c }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, startSaving] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Form state — initialized from server-passed contract.
  const [form, setForm] = useState({
    partner_short_name:      c.partner_short_name ?? '',
    partner_legal_name:      c.partner_legal_name ?? '',
    partner_type:            c.partner_type ?? 'DMC',
    country:                 c.country ?? '',
    country_flag:            c.country_flag ?? '',
    vat_number:              c.vat_number ?? '',
    address:                 c.address ?? '',
    contact_name:            c.contact_name ?? '',
    contact_role:            c.contact_role ?? '',
    contact_email:           c.contact_email ?? '',
    contact_phone:           c.contact_phone ?? '',
    effective_date:          c.effective_date ?? '',
    expiry_date:             c.expiry_date ?? '',
    auto_renew:              !!c.auto_renew,
    pricing_model:           c.pricing_model ?? '',
    commission_pct:          c.commission_pct ?? '',
    group_surcharge_pct:     c.group_surcharge_pct ?? '',
    group_threshold:         c.group_threshold ?? '',
    extra_bed_usd:           c.extra_bed_usd ?? '',
    anti_publication_clause: c.anti_publication_clause ?? '',
  });

  const set = (k: keyof typeof form, v: string | boolean | number) =>
    setForm((p) => ({ ...p, [k]: v }));

  const save = () => {
    setErr(null);
    // Build patch — only include fields the user can actually clear; coerce
    // blank strings on numeric/date fields to null so the RPC writes NULL.
    const patch: Record<string, unknown> = {};
    const text = ['partner_short_name','partner_legal_name','partner_type','country','country_flag','vat_number','address','contact_name','contact_role','contact_email','contact_phone','pricing_model','anti_publication_clause'] as const;
    const dates = ['effective_date','expiry_date'] as const;
    const nums  = ['commission_pct','group_surcharge_pct','extra_bed_usd'] as const;
    const ints  = ['group_threshold'] as const;
    for (const k of text)  patch[k] = (form[k] as string).trim() || null;
    for (const k of dates) patch[k] = (form[k] as string).trim() || null;
    for (const k of nums)  { const v = String(form[k]).trim(); patch[k] = v === '' ? null : Number(v); }
    for (const k of ints)  { const v = String(form[k]).trim(); patch[k] = v === '' ? null : Math.round(Number(v)); }
    patch.auto_renew = !!form.auto_renew;

    startSaving(async () => {
      try {
        const res = await fetch(`/api/dmc/contract/${c.contract_id}/update`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ patch }),
        });
        const j = await res.json();
        if (!res.ok || !j.ok) {
          setErr(j.error || `HTTP ${res.status}`);
          return;
        }
        setEditing(false);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'save failed');
      }
    });
  };

  // ── Shared chrome ──────────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--t-xs)', color: 'var(--ink)', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
  };
  const valStyle: React.CSSProperties = {
    fontSize: 'var(--t-base)', color: 'var(--ink)', lineHeight: 1.55,
  };
  const cellStyle: React.CSSProperties = {
    background: 'var(--paper)', border: '1px solid var(--paper-deep)',
    borderRadius: 6, padding: '12px 14px',
  };

  const previewHref = c.pdf_storage_path
    ? `/api/dmc/contract/${c.contract_id}/preview`
    : null;

  // ── Status strip (always rendered identically) ─────────────────────────
  const statusBg = c.computed_status === 'active' ? 'var(--st-good-bg)' : c.computed_status === 'expiring' ? 'var(--st-warn-bg)' : 'var(--st-bad-bg)';
  const statusBd = c.computed_status === 'active' ? 'var(--st-good-bd)' : c.computed_status === 'expiring' ? 'var(--st-warn-bd)' : 'var(--st-bad-bd)';
  const statusFg = c.computed_status === 'active' ? 'var(--moss-glow)' : c.computed_status === 'expiring' ? 'var(--brass)' : 'var(--st-bad)';
  const statusEmoji = c.computed_status === 'active' ? '🟢' : c.computed_status === 'expiring' ? '🟡' : c.computed_status === 'expired' ? '🔴' : '○';
  const daysLeft = c.days_to_expiry;

  return (
    <Container
      title={`DMC contract · ${c.partner_short_name}`}
      subtitle={`Commercial terms from governance.dmc_contracts · ${c.partner_type} · ${c.country_flag ?? ''} ${c.country ?? '—'}`}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span style={{ background: statusBg, border: `1px solid ${statusBd}`, color: statusFg, padding: '3px 10px', borderRadius: 12, fontSize: 'var(--t-sm)', fontWeight: 600 }}>
            {statusEmoji} {c.computed_status.charAt(0).toUpperCase() + c.computed_status.slice(1)}
          </span>
          <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>
            LPA {c.effective_date?.slice(0, 4) ?? '—'}–{c.expiry_date?.slice(0, 4) ?? '—'}
            {c.expiry_date ? ` · expires ${c.expiry_date}` : ''}
            {daysLeft != null ? ` (${daysLeft > 0 ? `${daysLeft} days` : daysLeft === 0 ? 'today' : `${Math.abs(daysLeft)}d ago`})` : ''}
          </span>
          <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>
            Auto-renew {c.auto_renew ? <strong style={{ color: 'var(--moss-glow)' }}>YES</strong> : <strong style={{ color: 'var(--st-bad)' }}>NO</strong>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {previewHref ? (
            <a href={previewHref} target="_blank" rel="noopener noreferrer" style={pdfBtnStyle}>📄 Preview contract</a>
          ) : (
            <span style={{ ...pdfBtnStyle, opacity: 0.5, cursor: 'not-allowed' }}>📄 No PDF on file</span>
          )}
          <Link href="/sales/b2b" style={pdfBtnStyle}>🏢 B2B</Link>
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)} style={editBtnStyle}>✎ Edit</button>
          ) : (
            <>
              <button type="button" onClick={() => { setEditing(false); setErr(null); }} style={cancelBtnStyle} disabled={saving}>
                Cancel
              </button>
              <button type="button" onClick={save} style={saveBtnStyle} disabled={saving}>
                {saving ? 'Saving…' : '✓ Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {err && (
        <div style={{ marginBottom: 12, padding: 10, background: 'var(--st-bad-bg)', border: '1px solid var(--st-bad-bd)', borderRadius: 6, fontSize: 12, color: 'var(--st-bad)' }}>
          Save failed: {err}
        </div>
      )}

      {!editing ? (
        // ─── READ MODE ─────────────────────────────────────────────────
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <div style={cellStyle}>
              <div style={labelStyle}>Pricing posture</div>
              <div style={valStyle}>
                <strong>{c.pricing_model}</strong>
                {c.commission_pct != null ? <> · {c.commission_pct}% commission</> : null}
                {c.group_surcharge_pct != null ? <><br />group surcharge +{c.group_surcharge_pct}%</> : null}
                {c.group_threshold != null ? <> ({c.group_threshold}+ keys)</> : null}
                {c.extra_bed_usd != null ? <><br />extra bed ${c.extra_bed_usd}</> : null}
              </div>
            </div>
            <div style={cellStyle}>
              <div style={labelStyle}>Contact</div>
              <div style={valStyle}>
                {c.contact_name ?? <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                {c.contact_role ? <> · {c.contact_role}</> : null}
                <br />
                {c.contact_email ? <a href={`mailto:${c.contact_email}`} style={{ color: 'var(--ink)', textDecoration: 'underline' }}>✉ {c.contact_email}</a> : <span style={{ color: 'var(--ink-faint)' }}>✉ —</span>}
                <br />
                {c.contact_phone ? <a href={`tel:${c.contact_phone}`} style={{ color: 'var(--ink)', textDecoration: 'underline' }}>📞 {c.contact_phone}</a> : <span style={{ color: 'var(--ink-faint)' }}>📞 —</span>}
              </div>
            </div>
            <div style={cellStyle}>
              <div style={labelStyle}>Validity</div>
              <div style={valStyle}>
                <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>Signed</span>{' '}
                <strong>{c.signed_date ?? <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>—</span>}</strong>
                <br />
                <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>Valid until</span>{' '}
                <strong>{c.expiry_date ?? <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>—</span>}</strong>
                <br />
                {daysLeft != null && daysLeft > 0 ? (
                  <>
                    <strong style={{ fontSize: 'var(--t-lg)', color: daysLeft < 90 ? 'var(--brass)' : 'var(--ink)' }}>{daysLeft} days left</strong>
                    <br />
                    <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>auto-alerts at 90/60/30/14/7/1 days</span>
                  </>
                ) : daysLeft != null && daysLeft <= 0 ? (
                  <span style={{
                    display: 'inline-block',
                    marginTop: 4,
                    padding: '4px 10px',
                    background: 'var(--st-bad-bg)',
                    border: '1px solid var(--st-bad-bd)',
                    color: 'var(--st-bad)',
                    borderRadius: 4,
                    fontSize: 'var(--t-sm)',
                    fontWeight: 700,
                  }}>
                    🔴 EXPIRED — no rate agreement
                  </span>
                ) : (
                  <span style={{ color: 'var(--ink-faint)' }}>no expiry on file</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div style={cellStyle}>
              <div style={labelStyle}>Legal identity</div>
              <div style={valStyle}>
                VAT: <code style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)' }}>{c.vat_number ?? '—'}</code>
                <br />
                Address: {c.address ?? <span style={{ color: 'var(--ink-faint)' }}>—</span>}
              </div>
            </div>
            <div style={cellStyle}>
              <div style={labelStyle}>Anti-publication clause</div>
              <div style={{ ...valStyle, fontSize: 'var(--t-sm)' }}>
                {c.anti_publication_clause
                  ? <><strong style={{ color: 'var(--moss-glow)' }}>✓ Present</strong> — {c.anti_publication_clause.slice(0, 180)}{c.anti_publication_clause.length > 180 ? '…' : ''}</>
                  : <span style={{ color: 'var(--ink-faint)' }}>not captured</span>}
              </div>
            </div>
          </div>
        </>
      ) : (
        // ─── EDIT MODE ─────────────────────────────────────────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Partner short name">
            <input value={form.partner_short_name} onChange={(e) => set('partner_short_name', e.target.value)} style={inputStyle} />
          </Field>
          <div style={twoCol}>
            <Field label="Partner legal name">
              <input value={form.partner_legal_name} onChange={(e) => set('partner_legal_name', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Partner type">
              <select value={form.partner_type} onChange={(e) => set('partner_type', e.target.value)} style={inputStyle}>
                <option value="DMC">DMC</option>
                <option value="TO">TO</option>
                <option value="OTA">OTA</option>
              </select>
            </Field>
          </div>

          <div style={threeCol}>
            <Field label="Country">
              <input value={form.country} onChange={(e) => set('country', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Flag (emoji)">
              <input value={form.country_flag} onChange={(e) => set('country_flag', e.target.value)} style={inputStyle} placeholder="🇱🇦" />
            </Field>
            <Field label="VAT number">
              <input value={form.vat_number} onChange={(e) => set('vat_number', e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label="Address">
            <textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} style={{ ...inputStyle, fontFamily: 'inherit' }} />
          </Field>

          <h4 style={sectionHeaderStyle}>Contact</h4>
          <div style={twoCol}>
            <Field label="Contact name">
              <input value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Contact role">
              <input value={form.contact_role} onChange={(e) => set('contact_role', e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <div style={twoCol}>
            <Field label="Contact email">
              <input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Contact phone">
              <input value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <h4 style={sectionHeaderStyle}>Dates & renewal</h4>
          <div style={threeCol}>
            <Field label="Effective">
              <input type="date" value={form.effective_date} onChange={(e) => set('effective_date', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Expiry">
              <input type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Auto-renew">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={form.auto_renew} onChange={(e) => set('auto_renew', e.target.checked)} />
                Auto-renews on expiry
              </label>
            </Field>
          </div>

          <h4 style={sectionHeaderStyle}>Pricing posture</h4>
          <div style={twoCol}>
            <Field label="Pricing model">
              <input value={form.pricing_model} onChange={(e) => set('pricing_model', e.target.value)} placeholder="net_lpa · gross_commissionable · hybrid" style={inputStyle} />
            </Field>
            <Field label="Commission %">
              <input type="number" step="0.5" value={form.commission_pct} onChange={(e) => set('commission_pct', e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <div style={threeCol}>
            <Field label="Group surcharge %">
              <input type="number" step="0.5" value={form.group_surcharge_pct} onChange={(e) => set('group_surcharge_pct', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Group threshold (keys)">
              <input type="number" step="1" value={form.group_threshold} onChange={(e) => set('group_threshold', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Extra bed (USD)">
              <input type="number" step="1" value={form.extra_bed_usd} onChange={(e) => set('extra_bed_usd', e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label="Anti-publication clause">
            <textarea value={form.anti_publication_clause} onChange={(e) => set('anti_publication_clause', e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: 'inherit' }} />
          </Field>

          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
            Saved fields write to <code>governance.dmc_contracts</code>. PDF / signed-document fields are managed via <Link href="/legal/docs" style={{ color: 'var(--brass)' }}>Legal · Documents</Link>.
          </div>
        </div>
      )}
    </Container>
  );
}

// ─── Small atoms ──────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  background: 'var(--paper)',
  color: 'var(--ink)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 4,
  fontSize: 13,
  fontFamily: 'inherit',
};

const sectionHeaderStyle: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--ink)',
  borderBottom: '1px solid var(--paper-deep)',
  paddingBottom: 4,
};

const twoCol: React.CSSProperties   = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const threeCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 };

const pdfBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', background: 'var(--paper)', color: 'var(--ink)',
  border: '1px solid var(--ink)', borderRadius: 4,
  fontSize: 12, fontWeight: 500, textDecoration: 'none',
};

const editBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', background: 'var(--primary, #1F3A2E)', color: '#FFFFFF',
  border: '1px solid var(--primary, #1F3A2E)', borderRadius: 4,
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  ...editBtnStyle,
  background: 'var(--moss-glow, #4F9B8E)',
  border: '1px solid var(--moss-glow, #4F9B8E)',
};

const cancelBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', background: 'var(--paper)', color: 'var(--ink)',
  border: '1px solid var(--paper-deep)', borderRadius: 4,
  fontSize: 12, fontWeight: 500, cursor: 'pointer',
};
