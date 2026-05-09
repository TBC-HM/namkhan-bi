// app/settings/channel-contacts/page.tsx
// Admin form for editing revenue.channel_contacts (one row per OTA / channel).
// Reads public.v_channel_contacts. Writes through public.f_set_channel_contact RPC.

import Page from '@/components/page/Page';
import { supabase } from '@/lib/supabase';
import ContactsForm, { type ContactRow } from './ContactsForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_SOURCES = ['Booking.com', 'Expedia', 'Agoda', 'Airbnb', 'Direct'];

export default async function ChannelContactsPage() {
  const { data } = await supabase.from('v_channel_contacts').select('*');
  const existing = new Map<string, ContactRow>(
    ((data ?? []) as any[]).map((r) => [String(r.source_name), {
      source_name: String(r.source_name),
      account_id: r.account_id ?? '',
      property_url: r.property_url ?? '',
      channel_manager_name: r.channel_manager_name ?? '',
      channel_manager_role: r.channel_manager_role ?? '',
      channel_manager_email: r.channel_manager_email ?? '',
      channel_manager_phone: r.channel_manager_phone ?? '',
      accounting_name: r.accounting_name ?? '',
      accounting_email: r.accounting_email ?? '',
      accounting_phone: r.accounting_phone ?? '',
      connectivity_provider: r.connectivity_provider ?? '',
      commission_pct: r.commission_pct != null ? String(r.commission_pct) : '',
      contract_start: r.contract_start ?? '',
      contract_renewal: r.contract_renewal ?? '',
      notes: r.notes ?? '',
      updated_at: r.updated_at ?? null,
    }])
  );

  const rows: ContactRow[] = KNOWN_SOURCES.map((name) => existing.get(name) ?? {
    source_name: name,
    account_id: '', property_url: '',
    channel_manager_name: '', channel_manager_role: '',
    channel_manager_email: '', channel_manager_phone: '',
    accounting_name: '', accounting_email: '', accounting_phone: '',
    connectivity_provider: '', commission_pct: '',
    contract_start: '', contract_renewal: '', notes: '',
    updated_at: null,
  });

  // Append any rows in DB that aren't in KNOWN_SOURCES
  for (const [name, row] of existing.entries()) {
    if (!KNOWN_SOURCES.includes(name)) rows.push(row);
  }

  return (
    <Page eyebrow="Settings · Channel contacts" title={<>Channel <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>contacts</em></>}>
      <ContactsForm rows={rows} />
    </Page>
  );
}
