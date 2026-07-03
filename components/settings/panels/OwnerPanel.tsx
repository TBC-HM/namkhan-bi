// components/settings/panels/OwnerPanel.tsx
// PBS 2026-07-03: owner entity — company legal + registration + bank details.
// Writes via SECURITY DEFINER fn_upsert_property_owner (single-row upsert).
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader } from './_shared';
import { supabase } from '@/lib/supabase';

type OwnerRow = {
  property_id: number;
  company_name: string | null;
  registered_address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  company_registration: string | null;
  vat_registration: string | null;
  bank_name: string | null;
  bank_current_account: string | null;
  bank_savings_account: string | null;
  additional_notes: string | null;
} | null;

interface Draft {
  company_name: string;
  registered_address: string;
  city: string;
  country: string;
  phone: string;
  company_registration: string;
  vat_registration: string;
  bank_name: string;
  bank_current_account: string;
  bank_savings_account: string;
  additional_notes: string;
}

function toDraft(r: OwnerRow): Draft {
  return {
    company_name:         r?.company_name         ?? '',
    registered_address:   r?.registered_address   ?? '',
    city:                 r?.city                 ?? '',
    country:              r?.country              ?? '',
    phone:                r?.phone                ?? '',
    company_registration: r?.company_registration ?? '',
    vat_registration:     r?.vat_registration     ?? '',
    bank_name:            r?.bank_name            ?? '',
    bank_current_account: r?.bank_current_account ?? '',
    bank_savings_account: r?.bank_savings_account ?? '',
    additional_notes:     r?.additional_notes     ?? '',
  };
}

export default function OwnerPanel({ data, propertyId }: { data: OwnerRow; propertyId: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(data));
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setF<K extends keyof Draft>(k: K, v: Draft[K]) { setDraft((d) => ({ ...d, [k]: v })); }

  function save() {
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_owner', {
        p_property_id:          propertyId,
        p_company_name:         draft.company_name.trim() || null,
        p_registered_address:   draft.registered_address.trim() || null,
        p_city:                 draft.city.trim() || null,
        p_country:              draft.country.trim() || null,
        p_phone:                draft.phone.trim() || null,
        p_company_registration: draft.company_registration.trim() || null,
        p_vat_registration:     draft.vat_registration.trim() || null,
        p_bank_name:            draft.bank_name.trim() || null,
        p_bank_current:         draft.bank_current_account.trim() || null,
        p_bank_savings:         draft.bank_savings_account.trim() || null,
        p_additional_notes:     draft.additional_notes.trim() || null,
      });
      if (e) { setError(e.message); return; }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div>
      <PanelHeader
        title="Owner"
        subtitle="Legal entity that owns this property · company registration · bank details"
        action={
          editing ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={save} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => { setEditing(false); setDraft(toDraft(data)); setError(null); }} disabled={busy} style={btnGhost}>Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} style={btnPrimary}>Edit</button>
          )
        }
      />

      {error && (
        <div style={{ margin: '12px 20px', padding: 10, background: '#FBE8E4', border: '1px solid #E8B7AB', borderRadius: 4, fontSize: 12, color: '#8A2419' }}>
          {error}
        </div>
      )}

      {!editing ? (
        <div>
          <Section title="Company">
            <F label="Company name" value={data?.company_name} span={2} />
            <F label="Registration No." value={data?.company_registration} />
            <F label="Phone" value={data?.phone} />
            <F label="VAT registration" value={data?.vat_registration} />
            <F label="—" value="" />
          </Section>
          <Section title="Registered address">
            <F label="Address" value={data?.registered_address} span={2} />
            <F label="City" value={data?.city} />
            <F label="Country" value={data?.country} />
            <F label="—" value="" />
            <F label="—" value="" />
          </Section>
          <Section title="Bank">
            <F label="Bank" value={data?.bank_name} />
            <F label="Current account" value={data?.bank_current_account} />
            <F label="Savings account" value={data?.bank_savings_account} />
          </Section>
          {data?.additional_notes && (
            <Section title="Notes">
              <F label="Additional notes" value={data.additional_notes} span={3} />
            </Section>
          )}
        </div>
      ) : (
        <div style={{ padding: 20, background: '#FAFAF7' }}>
          <FormSection title="Company">
            <FieldInput label="Company name" value={draft.company_name} onChange={(v) => setF('company_name', v)} span={2} />
            <FieldInput label="Registration No." value={draft.company_registration} onChange={(v) => setF('company_registration', v)} />
            <FieldInput label="Phone" value={draft.phone} onChange={(v) => setF('phone', v)} />
            <FieldInput label="VAT registration" value={draft.vat_registration} onChange={(v) => setF('vat_registration', v)} />
          </FormSection>
          <FormSection title="Registered address">
            <FieldInput label="Address" value={draft.registered_address} onChange={(v) => setF('registered_address', v)} span={2} />
            <FieldInput label="City" value={draft.city} onChange={(v) => setF('city', v)} />
            <FieldInput label="Country" value={draft.country} onChange={(v) => setF('country', v)} />
          </FormSection>
          <FormSection title="Bank">
            <FieldInput label="Bank" value={draft.bank_name} onChange={(v) => setF('bank_name', v)} />
            <FieldInput label="Current account" value={draft.bank_current_account} onChange={(v) => setF('bank_current_account', v)} />
            <FieldInput label="Savings account" value={draft.bank_savings_account} onChange={(v) => setF('bank_savings_account', v)} />
          </FormSection>
          <FormSection title="Notes">
            <FieldTextarea label="Additional notes" value={draft.additional_notes} onChange={(v) => setF('additional_notes', v)} span={3} />
          </FormSection>
        </div>
      )}
    </div>
  );
}

// ─── local field primitives (paper-white, no dark tokens) ───────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: '16px 20px', borderBottom: '1px solid #E6DFCC' }}>
      <h3 style={sectionTitle}>{title}</h3>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px 24px', margin: 0 }}>{children}</dl>
    </section>
  );
}
function F({ label, value, span = 1 }: { label: string; value: string | null | undefined; span?: 1 | 2 | 3 }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <dt style={fieldLabel}>{label}</dt>
      <dd style={{ fontSize: 13, margin: 0, color: empty ? '#8A8A8A' : '#1B1B1B', fontStyle: empty ? 'italic' : 'normal', wordBreak: 'break-word' }}>
        {empty ? '—' : value}
      </dd>
    </div>
  );
}
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={sectionTitle}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>{children}</div>
    </div>
  );
}
function FieldInput({ label, value, onChange, span = 1 }: { label: string; value: string; onChange: (v: string) => void; span?: 1 | 2 | 3 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <div style={fieldLabel}>{label}</div>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={input} />
    </div>
  );
}
function FieldTextarea({ label, value, onChange, span = 1 }: { label: string; value: string; onChange: (v: string) => void; span?: 1 | 2 | 3 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <div style={fieldLabel}>{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
    </div>
  );
}

const btnPrimary: React.CSSProperties = { padding: '7px 14px', background: '#1F3A2E', color: '#FFFFFF', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: React.CSSProperties = { padding: '7px 14px', background: '#FFFFFF', color: '#1B1B1B', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' };
const input: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', fontSize: 13, fontFamily: 'inherit' };
const fieldLabel: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 4 };
const sectionTitle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1F3A2E', margin: '0 0 12px' };
