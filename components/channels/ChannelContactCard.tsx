// components/channels/ChannelContactCard.tsx — left-rail contact card.
// Reads public.v_channel_contacts. Renders fields with em-dash for empty values.
// Edit values via /settings/channel-contacts (or direct DB) until admin UI lands.

import { supabase } from '@/lib/supabase';

interface ContactRow {
  source_name: string;
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
  notes: string | null;
  updated_at: string | null;
}

const EMPTY = '—';

async function getContact(sourceName: string): Promise<ContactRow | null> {
  const { data, error } = await supabase
    .from('v_channel_contacts')
    .select('*')
    .eq('source_name', sourceName)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as ContactRow;
}

function Field({ label, value, href }: { label: string; value: string | null | undefined; href?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--t-sm)', color: value ? 'var(--ink)' : 'var(--ink-mute)', lineHeight: 1.35, wordBreak: 'break-word' }}>
        {!value ? EMPTY : href ? <a href={href} style={{ color: 'var(--brass)', textDecoration: 'underline' }}>{value}</a> : value}
      </div>
    </div>
  );
}

export default async function ChannelContactCard({ sourceName }: { sourceName: string }) {
  const c = await getContact(sourceName);

  // Default render even when row is missing — show empty state with "edit DB" hint
  const empty: ContactRow = c ?? {
    source_name: sourceName,
    account_id: null, property_url: null,
    channel_manager_name: null, channel_manager_role: null,
    channel_manager_email: null, channel_manager_phone: null,
    accounting_name: null, accounting_email: null, accounting_phone: null,
    connectivity_provider: null, commission_pct: null,
    contract_start: null, contract_renewal: null,
    notes: null, updated_at: null,
  };

  const updatedLabel = empty.updated_at
    ? new Date(empty.updated_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' })
    : EMPTY;

  return (
    <div style={{
      background: 'var(--paper-warm)',
      border: '1px solid var(--paper-deep)',
      borderRadius: 8,
      padding: '14px 16px',
      position: 'sticky',
      top: 12,
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)' }}>
          Channel contact
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500, color: 'var(--ink)', marginTop: 4 }}>
          {empty.source_name}
        </div>
        {empty.property_url && (
          <a href={empty.property_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: 'var(--t-xs)', color: 'var(--brass)', marginTop: 4, wordBreak: 'break-all' }}>
            {empty.property_url.replace(/^https?:\/\/(www\.)?/, '')}
          </a>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--paper-deep)', paddingTop: 10, marginBottom: 4 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--ink-mute)', marginBottom: 8 }}>
          Account
        </div>
        <Field label="Account ID" value={empty.account_id} />
        <Field label="Commission" value={empty.commission_pct != null ? `${empty.commission_pct}%` : null} />
        <Field label="Connectivity" value={empty.connectivity_provider} />
      </div>

      <div style={{ borderTop: '1px solid var(--paper-deep)', paddingTop: 10, marginBottom: 4 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--ink-mute)', marginBottom: 8 }}>
          Channel manager
        </div>
        <Field label="Name" value={empty.channel_manager_name ? `${empty.channel_manager_name}${empty.channel_manager_role ? ` · ${empty.channel_manager_role}` : ''}` : null} />
        <Field label="Email" value={empty.channel_manager_email} href={empty.channel_manager_email ? `mailto:${empty.channel_manager_email}` : undefined} />
        <Field label="Phone" value={empty.channel_manager_phone} href={empty.channel_manager_phone ? `tel:${empty.channel_manager_phone}` : undefined} />
      </div>

      <div style={{ borderTop: '1px solid var(--paper-deep)', paddingTop: 10, marginBottom: 4 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--ink-mute)', marginBottom: 8 }}>
          Accounting
        </div>
        <Field label="Contact" value={empty.accounting_name} />
        <Field label="Email" value={empty.accounting_email} href={empty.accounting_email ? `mailto:${empty.accounting_email}` : undefined} />
        <Field label="Phone" value={empty.accounting_phone} href={empty.accounting_phone ? `tel:${empty.accounting_phone}` : undefined} />
      </div>

      <div style={{ borderTop: '1px solid var(--paper-deep)', paddingTop: 10, marginBottom: 4 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--ink-mute)', marginBottom: 8 }}>
          Contract
        </div>
        <Field label="Start" value={empty.contract_start} />
        <Field label="Renewal" value={empty.contract_renewal} />
      </div>

      {empty.notes && (
        <div style={{ borderTop: '1px solid var(--paper-deep)', paddingTop: 10, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', lineHeight: 1.4 }}>
          {empty.notes}
        </div>
      )}

      <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--paper-deep)', fontSize: '10px', color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
        Updated {updatedLabel} · edit via /settings/channel-contacts
      </div>
    </div>
  );
}
