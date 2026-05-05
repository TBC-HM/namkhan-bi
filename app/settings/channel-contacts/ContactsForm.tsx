'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export interface ContactRow {
  source_name: string;
  account_id: string;
  property_url: string;
  channel_manager_name: string;
  channel_manager_role: string;
  channel_manager_email: string;
  channel_manager_phone: string;
  accounting_name: string;
  accounting_email: string;
  accounting_phone: string;
  connectivity_provider: string;
  commission_pct: string;
  contract_start: string;
  contract_renewal: string;
  notes: string;
  updated_at: string | null;
}

const FIELDS: { key: keyof ContactRow; label: string; type: string; section: string; placeholder?: string }[] = [
  { key: 'account_id',            label: 'Account ID',          type: 'text',  section: 'Account' },
  { key: 'property_url',          label: 'Property URL',        type: 'url',   section: 'Account', placeholder: 'https://...' },
  { key: 'commission_pct',        label: 'Commission %',        type: 'number', section: 'Account' },
  { key: 'connectivity_provider', label: 'Connectivity',        type: 'text',  section: 'Account', placeholder: 'SiteMinder, Cloudbeds Direct, ...' },

  { key: 'channel_manager_name',  label: 'Channel manager name',  type: 'text',  section: 'Channel manager' },
  { key: 'channel_manager_role',  label: 'Role',                  type: 'text',  section: 'Channel manager' },
  { key: 'channel_manager_email', label: 'Email',                 type: 'email', section: 'Channel manager' },
  { key: 'channel_manager_phone', label: 'Phone',                 type: 'tel',   section: 'Channel manager' },

  { key: 'accounting_name',  label: 'Accounting contact', type: 'text',  section: 'Accounting' },
  { key: 'accounting_email', label: 'Email',              type: 'email', section: 'Accounting' },
  { key: 'accounting_phone', label: 'Phone',              type: 'tel',   section: 'Accounting' },

  { key: 'contract_start',   label: 'Contract start',     type: 'date', section: 'Contract' },
  { key: 'contract_renewal', label: 'Contract renewal',   type: 'date', section: 'Contract' },
];

const SECTIONS = ['Account', 'Channel manager', 'Accounting', 'Contract'];

export default function ContactsForm({ rows }: { rows: ContactRow[] }) {
  const [active, setActive] = useState(rows[0]?.source_name ?? 'Booking.com');
  const [data, setData] = useState<Record<string, ContactRow>>(
    Object.fromEntries(rows.map((r) => [r.source_name, r]))
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const current = data[active];

  function update(key: keyof ContactRow, value: string) {
    setData((d) => ({ ...d, [active]: { ...d[active], [key]: value } }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = current;
    const { error } = await supabase.rpc('f_set_channel_contact', {
      p_source_name:           r.source_name,
      p_account_id:            r.account_id,
      p_property_url:          r.property_url,
      p_channel_manager_name:  r.channel_manager_name,
      p_channel_manager_role:  r.channel_manager_role,
      p_channel_manager_email: r.channel_manager_email,
      p_channel_manager_phone: r.channel_manager_phone,
      p_accounting_name:       r.accounting_name,
      p_accounting_email:      r.accounting_email,
      p_accounting_phone:      r.accounting_phone,
      p_connectivity_provider: r.connectivity_provider,
      p_commission_pct:        r.commission_pct === '' ? null : Number(r.commission_pct),
      p_contract_start:        r.contract_start === '' ? null : r.contract_start,
      p_contract_renewal:      r.contract_renewal === '' ? null : r.contract_renewal,
      p_notes:                 r.notes,
    });
    setSaving(false);
    if (error) setMsg(`Error: ${error.message}`);
    else {
      setMsg(`Saved ${r.source_name} · ${new Date().toLocaleTimeString('en-GB')}`);
      setTimeout(() => window.location.reload(), 800);
    }
  }

  const updatedLabel = current?.updated_at
    ? new Date(current.updated_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '16px 20px', marginTop: 14 }}>
      {/* Channel selector */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--paper-deep)', marginBottom: 16 }}>
        {Object.keys(data).map((name) => {
          const isActive = name === active;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setActive(name)}
              style={{
                padding: '10px 18px',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--ls-extra)',
                color: isActive ? 'var(--ink)' : 'var(--ink-mute)',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--brass)' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {name}
            </button>
          );
        })}
      </div>

      {!current ? (
        <div style={{ color: 'var(--ink-mute)' }}>No row selected.</div>
      ) : (
        <>
          {SECTIONS.map((section) => (
            <div key={section} style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 8 }}>
                {section}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {FIELDS.filter((f) => f.section === section).map((f) => (
                  <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{f.label}</label>
                    <input
                      type={f.type}
                      value={(current[f.key] as string) ?? ''}
                      placeholder={f.placeholder ?? ''}
                      onChange={(e) => update(f.key, e.target.value)}
                      style={{ padding: '6px 10px', border: '1px solid var(--line-soft)', borderRadius: 4, background: 'var(--paper-pure, #fff)', fontSize: 'var(--t-base)' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 8 }}>
              Notes
            </div>
            <textarea
              value={current.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line-soft)', borderRadius: 4, background: 'var(--paper-pure, #fff)', fontSize: 'var(--t-base)', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 8, borderTop: '1px solid var(--paper-deep)' }}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{
                padding: '8px 16px',
                background: 'var(--moss)',
                color: 'var(--paper-warm)',
                border: 'none',
                borderRadius: 4,
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--ls-extra)',
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : `Save ${current.source_name}`}
            </button>
            <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
              Last updated {updatedLabel}
            </span>
            {msg && <span style={{ fontSize: 'var(--t-xs)', color: msg.startsWith('Error') ? 'var(--st-bad-tx, #b03826)' : 'var(--moss-glow)' }}>{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}
