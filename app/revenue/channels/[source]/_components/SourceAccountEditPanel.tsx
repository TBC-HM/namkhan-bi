'use client';

// app/revenue/channels/[source]/_components/SourceAccountEditPanel.tsx
// Mirror of DmcContractEditPanel for non-DMC sources (OTA / Wholesale / Other).
// Same 3×2 grid + status strip + inline read/edit toggle.
// Wired to revenue.channel_contacts via /api/channel-contact/[source]/update.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/app/(cockpit)/_design';

export interface ChannelAccountRow {
  source_name: string;
  property_id: number;
  partner_type: string | null;
  partner_legal_name: string | null;
  country: string | null;
  country_flag: string | null;
  vat_number: string | null;
  address: string | null;
  account_id: string | null;
  property_url: string | null;
  channel_manager_name: string | null;
  channel_manager_role: string | null;
  channel_manager_email: string | null;
  channel_manager_phone: string | null;
  accounting_name: string | null;
  accounting_email: string | null;
  accounting_phone: string | null;
  connectivity_provider: string | null;
  commission_pct: number | null;
  contract_start: string | null;
  contract_renewal: string | null;
  auto_renew: boolean | null;
  pricing_model: string | null;
  group_surcharge_pct: number | null;
  group_threshold: number | null;
  extra_bed_usd: number | null;
  anti_publication_clause: string | null;
  termination_clause: string | null;
  cancellation_policy: string | null;
  notes: string | null;
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
  bank_swift_bic: string | null;
  bank_iban: string | null;
  computed_status: string | null;
  days_to_expiry: number | null;
}

interface Props {
  contact: ChannelAccountRow;
  sourceName: string;
  propertyId: number;
  cat: string;
}

export default function SourceAccountEditPanel({ contact: c, sourceName, propertyId, cat }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, startSaving] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    partner_legal_name:     c.partner_legal_name ?? '',
    partner_type:           c.partner_type ?? cat,
    country:                c.country ?? '',
    country_flag:           c.country_flag ?? '',
    vat_number:             c.vat_number ?? '',
    address:                c.address ?? '',
    account_id:             c.account_id ?? '',
    property_url:           c.property_url ?? '',
    channel_manager_name:   c.channel_manager_name ?? '',
    channel_manager_role:   c.channel_manager_role ?? '',
    channel_manager_email:  c.channel_manager_email ?? '',
    channel_manager_phone:  c.channel_manager_phone ?? '',
    accounting_name:        c.accounting_name ?? '',
    accounting_email:       c.accounting_email ?? '',
    accounting_phone:       c.accounting_phone ?? '',
    connectivity_provider:  c.connectivity_provider ?? '',
    commission_pct:         c.commission_pct ?? '',
    contract_start:         c.contract_start ?? '',
    contract_renewal:       c.contract_renewal ?? '',
    auto_renew:             !!c.auto_renew,
    pricing_model:          c.pricing_model ?? '',
    anti_publication_clause: c.anti_publication_clause ?? '',
    termination_clause:     c.termination_clause ?? '',
    cancellation_policy:    c.cancellation_policy ?? '',
    bank_name:              c.bank_name ?? '',
    bank_account_holder:    c.bank_account_holder ?? '',
    bank_account_number:    c.bank_account_number ?? '',
    bank_swift_bic:         c.bank_swift_bic ?? '',
    bank_iban:              c.bank_iban ?? '',
  });

  const set = (k: keyof typeof form, v: string | boolean | number) =>
    setForm((p) => ({ ...p, [k]: v }));

  const save = () => {
    setErr(null);
    const patch: Record<string, unknown> = {};
    const text = ['partner_type','partner_legal_name','country','country_flag','vat_number','address','account_id','property_url','channel_manager_name','channel_manager_role','channel_manager_email','channel_manager_phone','accounting_name','accounting_email','accounting_phone','connectivity_provider','pricing_model','anti_publication_clause','termination_clause','cancellation_policy','bank_name','bank_account_holder','bank_account_number','bank_swift_bic','bank_iban'] as const;
    const dates = ['contract_start','contract_renewal'] as const;
    const nums  = ['commission_pct'] as const;
    for (const k of text)  patch[k] = (form[k] as string).trim() || null;
    for (const k of dates) patch[k] = (form[k] as string).trim() || null;
    for (const k of nums)  { const v = String(form[k]).trim(); patch[k] = v === '' ? null : Number(v); }
    patch.auto_renew = !!form.auto_renew;

    startSaving(async () => {
      try {
        const res = await fetch(`/api/channel-contact/${encodeURIComponent(sourceName)}/update`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ patch, propertyId }),
        });
        const j = await res.json();
        if (!res.ok || !j.ok) { setErr(j.error || `HTTP ${res.status}`); return; }
        setEditing(false);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'save failed');
      }
    });
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--t-xs)', color: 'var(--ink)', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
  };
  const valStyle: React.CSSProperties = { fontSize: 'var(--t-base)', color: 'var(--ink)', lineHeight: 1.55 };
  const cellStyle: React.CSSProperties = {
    background: 'var(--paper)', border: '1px solid var(--paper-deep)',
    borderRadius: 6, padding: '12px 14px',
  };

  const editHref = `/settings/channel-contacts?source=${encodeURIComponent(sourceName)}`;
  const daysLeft = c.days_to_expiry;
  const statusBg = c.computed_status === 'active' ? 'var(--st-good-bg)' : c.computed_status === 'expiring' ? 'var(--st-warn-bg)' : 'var(--st-bad-bg)';
  const statusBd = c.computed_status === 'active' ? 'var(--st-good-bd)' : c.computed_status === 'expiring' ? 'var(--st-warn-bd)' : 'var(--st-bad-bd)';
  const statusFg = c.computed_status === 'active' ? 'var(--moss-glow)' : c.computed_status === 'expiring' ? 'var(--brass)' : 'var(--st-bad)';
  const statusEmoji = c.computed_status === 'active' ? '🟢' : c.computed_status === 'expiring' ? '🟡' : c.computed_status === 'expired' ? '🔴' : '○';

  return (
    <Container
      title={`Channel account · ${c.source_name}`}
      subtitle={`${c.partner_type ?? cat} · ${c.country_flag ?? ''} ${c.country ?? '—'} · edit inline or at /settings/channel-contacts`}
    >
      {/* Status + action buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span style={{ background: statusBg, border: `1px solid ${statusBd}`, color: statusFg, padding: '3px 10px', borderRadius: 12, fontSize: 'var(--t-sm)', fontWeight: 600 }}>
            {statusEmoji} {c.computed_status ? c.computed_status.charAt(0).toUpperCase() + c.computed_status.slice(1) : 'Draft'}
          </span>
          <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>
            Contract {c.contract_start?.slice(0, 4) ?? '—'}–{c.contract_renewal?.slice(0, 4) ?? '—'}
            {c.contract_renewal ? ` · renews ${c.contract_renewal}` : ''}
            {daysLeft != null ? ` (${daysLeft > 0 ? `${daysLeft} days` : daysLeft === 0 ? 'today' : `${Math.abs(daysLeft)}d ago`})` : ''}
          </span>
          <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>
            Auto-renew {c.auto_renew ? <strong style={{ color: 'var(--moss-glow)' }}>YES</strong> : <strong style={{ color: 'var(--st-bad)' }}>NO</strong>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {c.property_url && (
            <a href={c.property_url} target="_blank" rel="noopener noreferrer" style={pdfBtnStyle}>🔗 Extranet</a>
          )}
          <Link href={editHref} style={pdfBtnStyle}>⚙ Settings</Link>
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)} style={editBtnStyle}>✎ Edit</button>
          ) : (
            <>
              <button type="button" onClick={() => { setEditing(false); setErr(null); }} style={cancelBtnStyle} disabled={saving}>Cancel</button>
              <button type="button" onClick={save} style={saveBtnStyle} disabled={saving}>{saving ? 'Saving…' : '✓ Save'}</button>
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
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridAutoRows: '1fr', gap: 12 }}>
            <div style={{ ...cellStyle, display: 'flex', flexDirection: 'column' }}>
              <div style={labelStyle}>Commercial</div>
              <div style={valStyle}>
                <strong>{c.pricing_model ?? '—'}</strong>
                {c.commission_pct != null ? <> · {c.commission_pct}% commission</> : null}
                <br />Connectivity: {c.connectivity_provider ?? <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                <br />Account ID: <code style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)' }}>{c.account_id ?? '—'}</code>
              </div>
            </div>
            <div style={{ ...cellStyle, display: 'flex', flexDirection: 'column' }}>
              <div style={labelStyle}>Channel manager</div>
              <div style={valStyle}>
                {c.channel_manager_name ?? <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                {c.channel_manager_role ? <> · {c.channel_manager_role}</> : null}
                <br />
                {c.channel_manager_email ? <a href={`mailto:${c.channel_manager_email}`} style={{ color: 'var(--ink)', textDecoration: 'underline' }}>✉ {c.channel_manager_email}</a> : <span style={{ color: 'var(--ink-faint)' }}>✉ —</span>}
                <br />
                {c.channel_manager_phone ? <a href={`tel:${c.channel_manager_phone}`} style={{ color: 'var(--ink)', textDecoration: 'underline' }}>📞 {c.channel_manager_phone}</a> : <span style={{ color: 'var(--ink-faint)' }}>📞 —</span>}
              </div>
            </div>
            <div style={{ ...cellStyle, display: 'flex', flexDirection: 'column' }}>
              <div style={labelStyle}>Validity</div>
              <div style={valStyle}>
                <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>Signed</span>{' '}
                <strong>{c.contract_start ?? <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>—</span>}</strong>
                <br />
                <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>Valid until</span>{' '}
                <strong>{c.contract_renewal ?? <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>—</span>}</strong>
                <br />
                {daysLeft != null && daysLeft > 0 ? (
                  <>
                    <strong style={{ fontSize: 'var(--t-lg)', color: daysLeft < 90 ? 'var(--brass)' : 'var(--ink)' }}>{daysLeft} days left</strong>
                    <br />
                    <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>auto-alerts at 90/60/30/14/7/1 days</span>
                  </>
                ) : daysLeft != null && daysLeft <= 0 ? (
                  <span style={{ display: 'inline-block', marginTop: 4, padding: '4px 10px', background: 'var(--st-bad-bg)', border: '1px solid var(--st-bad-bd)', color: 'var(--st-bad)', borderRadius: 4, fontSize: 'var(--t-sm)', fontWeight: 700 }}>
                    🔴 EXPIRED — no rate agreement
                  </span>
                ) : (
                  <span style={{ color: 'var(--ink-faint)' }}>no expiry on file</span>
                )}
              </div>
            </div>
            <div style={{ ...cellStyle, display: 'flex', flexDirection: 'column' }}>
              <div style={labelStyle}>Accounting contact</div>
              <div style={valStyle}>
                {c.accounting_name ?? <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                <br />
                {c.accounting_email ? <a href={`mailto:${c.accounting_email}`} style={{ color: 'var(--ink)', textDecoration: 'underline' }}>✉ {c.accounting_email}</a> : <span style={{ color: 'var(--ink-faint)' }}>✉ —</span>}
                <br />
                {c.accounting_phone ? <a href={`tel:${c.accounting_phone}`} style={{ color: 'var(--ink)', textDecoration: 'underline' }}>📞 {c.accounting_phone}</a> : <span style={{ color: 'var(--ink-faint)' }}>📞 —</span>}
              </div>
            </div>
            <div style={{ ...cellStyle, display: 'flex', flexDirection: 'column' }}>
              <div style={labelStyle}>Bank & account info</div>
              <div style={{ ...valStyle, fontSize: 'var(--t-sm)' }}>
                {c.bank_name ? <><strong>{c.bank_name}</strong><br /></> : <><span style={{ color: 'var(--ink-faint)' }}>bank not set</span><br /></>}
                {c.bank_account_holder ? <>{c.bank_account_holder}<br /></> : null}
                {c.bank_account_number ? <>Acct: <code style={{ fontFamily: 'var(--mono)' }}>{c.bank_account_number}</code><br /></> : null}
                {c.bank_iban ? <>IBAN: <code style={{ fontFamily: 'var(--mono)' }}>{c.bank_iban}</code><br /></> : null}
                {c.bank_swift_bic ? <>SWIFT/BIC: <code style={{ fontFamily: 'var(--mono)' }}>{c.bank_swift_bic}</code></> : null}
              </div>
            </div>
            <div style={{ ...cellStyle, display: 'flex', flexDirection: 'column' }}>
              <div style={labelStyle}>Legal identity</div>
              <div style={valStyle}>
                {c.partner_legal_name ?? <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                <br />VAT: <code style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)' }}>{c.vat_number ?? '—'}</code>
                <br />Address: {c.address ?? <span style={{ color: 'var(--ink-faint)' }}>—</span>}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={twoCol}>
            <Field label="Partner legal name"><input value={form.partner_legal_name} onChange={(e) => set('partner_legal_name', e.target.value)} style={inputStyle} /></Field>
            <Field label="Partner type"><select value={form.partner_type} onChange={(e) => set('partner_type', e.target.value)} style={inputStyle}>
              <option value="OTA">OTA</option><option value="Wholesale">Wholesale</option><option value="DMC">DMC</option><option value="Direct">Direct</option><option value="Other">Other</option>
            </select></Field>
          </div>
          <div style={threeCol}>
            <Field label="Country"><input value={form.country} onChange={(e) => set('country', e.target.value)} style={inputStyle} /></Field>
            <Field label="Flag (emoji)"><input value={form.country_flag} onChange={(e) => set('country_flag', e.target.value)} placeholder="🇱🇦" style={inputStyle} /></Field>
            <Field label="VAT number"><input value={form.vat_number} onChange={(e) => set('vat_number', e.target.value)} style={inputStyle} /></Field>
          </div>
          <Field label="Address"><textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} style={{ ...inputStyle, fontFamily: 'inherit' }} /></Field>

          <h4 style={sectionHeaderStyle}>Extranet / connectivity</h4>
          <div style={threeCol}>
            <Field label="Account ID"><input value={form.account_id} onChange={(e) => set('account_id', e.target.value)} style={inputStyle} /></Field>
            <Field label="Extranet URL"><input value={form.property_url} onChange={(e) => set('property_url', e.target.value)} placeholder="https://…" style={inputStyle} /></Field>
            <Field label="Connectivity"><input value={form.connectivity_provider} onChange={(e) => set('connectivity_provider', e.target.value)} placeholder="SiteMinder / Witbooking / …" style={inputStyle} /></Field>
          </div>

          <h4 style={sectionHeaderStyle}>Channel manager contact</h4>
          <div style={twoCol}>
            <Field label="Name"><input value={form.channel_manager_name} onChange={(e) => set('channel_manager_name', e.target.value)} style={inputStyle} /></Field>
            <Field label="Role"><input value={form.channel_manager_role} onChange={(e) => set('channel_manager_role', e.target.value)} style={inputStyle} /></Field>
          </div>
          <div style={twoCol}>
            <Field label="Email"><input type="email" value={form.channel_manager_email} onChange={(e) => set('channel_manager_email', e.target.value)} style={inputStyle} /></Field>
            <Field label="Phone"><input value={form.channel_manager_phone} onChange={(e) => set('channel_manager_phone', e.target.value)} style={inputStyle} /></Field>
          </div>

          <h4 style={sectionHeaderStyle}>Accounting contact</h4>
          <div style={twoCol}>
            <Field label="Name"><input value={form.accounting_name} onChange={(e) => set('accounting_name', e.target.value)} style={inputStyle} /></Field>
            <Field label="Email"><input type="email" value={form.accounting_email} onChange={(e) => set('accounting_email', e.target.value)} style={inputStyle} /></Field>
          </div>
          <Field label="Phone"><input value={form.accounting_phone} onChange={(e) => set('accounting_phone', e.target.value)} style={inputStyle} /></Field>

          <h4 style={sectionHeaderStyle}>Contract & pricing</h4>
          <div style={threeCol}>
            <Field label="Contract start"><input type="date" value={form.contract_start} onChange={(e) => set('contract_start', e.target.value)} style={inputStyle} /></Field>
            <Field label="Contract renewal"><input type="date" value={form.contract_renewal} onChange={(e) => set('contract_renewal', e.target.value)} style={inputStyle} /></Field>
            <Field label="Auto-renew"><label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={form.auto_renew} onChange={(e) => set('auto_renew', e.target.checked)} /> Auto-renew
            </label></Field>
          </div>
          <div style={twoCol}>
            <Field label="Pricing model"><input value={form.pricing_model} onChange={(e) => set('pricing_model', e.target.value)} placeholder="gross_commissionable · net · …" style={inputStyle} /></Field>
            <Field label="Commission %"><input type="number" step="0.5" value={form.commission_pct} onChange={(e) => set('commission_pct', e.target.value)} style={inputStyle} /></Field>
          </div>

          <h4 style={sectionHeaderStyle}>Bank & account info</h4>
          <div style={twoCol}>
            <Field label="Bank name"><input value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} style={inputStyle} /></Field>
            <Field label="Account holder"><input value={form.bank_account_holder} onChange={(e) => set('bank_account_holder', e.target.value)} style={inputStyle} /></Field>
          </div>
          <div style={threeCol}>
            <Field label="Account number"><input value={form.bank_account_number} onChange={(e) => set('bank_account_number', e.target.value)} style={inputStyle} /></Field>
            <Field label="IBAN"><input value={form.bank_iban} onChange={(e) => set('bank_iban', e.target.value)} style={inputStyle} /></Field>
            <Field label="SWIFT / BIC"><input value={form.bank_swift_bic} onChange={(e) => set('bank_swift_bic', e.target.value)} style={inputStyle} /></Field>
          </div>
        </div>
      )}
    </Container>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', background: 'var(--paper)', color: 'var(--ink)',
  border: '1px solid var(--paper-deep)', borderRadius: 4, fontSize: 13, fontFamily: 'inherit',
};

const sectionHeaderStyle: React.CSSProperties = {
  margin: '8px 0 0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--ink)', borderBottom: '1px solid var(--paper-deep)', paddingBottom: 4,
};

const twoCol: React.CSSProperties   = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const threeCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 };

const pdfBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', background: 'var(--paper)', color: 'var(--ink)',
  border: '1px solid var(--ink)', borderRadius: 4, fontSize: 12, fontWeight: 500, textDecoration: 'none',
};

const editBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', background: 'var(--primary, #1F3A2E)', color: '#FFFFFF',
  border: '1px solid var(--primary, #1F3A2E)', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  ...editBtnStyle, background: 'var(--moss-glow, #4F9B8E)', border: '1px solid var(--moss-glow, #4F9B8E)',
};

const cancelBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', background: 'var(--paper)', color: 'var(--ink)',
  border: '1px solid var(--paper-deep)', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: 'pointer',
};
