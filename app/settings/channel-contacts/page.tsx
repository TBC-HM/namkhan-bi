// app/settings/channel-contacts/page.tsx
//
// Admin form for editing revenue.channel_contacts (one row per OTA / channel)
// PLUS a read-only DMC partner roster surfaced from governance.dmc_contracts.
// Reads public.v_channel_contacts. Writes through public.f_set_channel_contact RPC.
//
// PBS 2026-06-30:
//   - Migrated chrome from <Page> to <DashboardPage>+<Container> (v6/v7).
//   - Removed Agoda from KNOWN_SOURCES, added CTrip / Trip.com (matches the
//     source_name that lands from PMS so its contact row resolves cleanly).
//   - New DMC section: list of all governance.dmc_contracts with key contact
//     fields + a per-row link to the full /sales/b2b/partner detail surface
//     where commercial terms are edited.

import Link from 'next/link';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import ContactsForm, { type ContactRow } from './ContactsForm';
import { getDmcContracts } from '@/lib/dmc';
import { SETTINGS_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// PBS 2026-06-30: dropped Agoda (we don't have a contract), added CTrip/Trip.com.
// The string must match the Cloudbeds source_name so the channel_contacts row
// resolves on the source landing page tooltip.
const KNOWN_SOURCES = ['Booking.com', 'Expedia', 'CTrip / Trip.com', 'Airbnb', 'Direct'];

export default async function ChannelContactsPage() {
  const [contactsRes, dmcContracts] = await Promise.all([
    supabase.from('v_channel_contacts').select('*'),
    getDmcContracts().catch(() => []),
  ]);
  const data = contactsRes.data;

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

  // Append any rows in DB that aren't in KNOWN_SOURCES (legacy / new arrivals).
  // Skip Agoda explicitly so it doesn't get re-added by a stale DB row.
  for (const [name, row] of existing.entries()) {
    if (!KNOWN_SOURCES.includes(name) && name !== 'Agoda') rows.push(row);
  }

  const settingsTabs: DashboardTab[] = SETTINGS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: false,
  }));

  // Sort DMC contracts: nearest expiry first; nulls at the bottom.
  const dmcSorted = [...dmcContracts].sort((a, b) => {
    if (!a.expiry_date && !b.expiry_date) return a.partner_short_name.localeCompare(b.partner_short_name);
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    return a.expiry_date.localeCompare(b.expiry_date);
  });

  const today = new Date();
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <DashboardPage
      title="Channel contacts"
      subtitle="OTA + Direct extranet credentials · DMC partner roster (read-only — edit at /sales/b2b)"
      tabs={settingsTabs}
    >
      <Container title="OTA + Direct" subtitle={`${rows.length} channels · click to edit · saves to revenue.channel_contacts via f_set_channel_contact`}>
        <ContactsForm rows={rows} />
      </Container>

      <Container
        title={`DMC partners · ${dmcSorted.length} contracts`}
        subtitle="Read-only view of governance.dmc_contracts · click any partner to open the full B2B detail surface"
        action={
          <Link
            href="/sales/b2b"
            style={{
              padding: '6px 12px', fontSize: 11, letterSpacing: '0.08em',
              textTransform: 'uppercase', fontWeight: 600,
              background: 'var(--primary, #1F3A2E)', color: '#FFFFFF',
              borderRadius: 4, textDecoration: 'none',
            }}
          >
            Open B2B / DMC →
          </Link>
        }
      >
        {dmcSorted.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
            No DMC contracts on file. Add one at /sales/b2b.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--hairline, #E6DFCC)', textAlign: 'left' }}>
                  <th style={th}>Partner</th>
                  <th style={th}>Type</th>
                  <th style={th}>Country</th>
                  <th style={th}>Status</th>
                  <th style={th}>Contact</th>
                  <th style={th}>Email · phone</th>
                  <th style={{ ...th, textAlign: 'right' }}>Commission</th>
                  <th style={{ ...th, textAlign: 'right' }}>Group +%</th>
                  <th style={th}>Signed</th>
                  <th style={th}>Expires</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {dmcSorted.map((c) => {
                  const expiry = c.expiry_date ? new Date(c.expiry_date) : null;
                  const daysLeft = expiry ? Math.round((expiry.getTime() - today.getTime()) / 86_400_000) : null;
                  const expiryColor =
                    daysLeft == null ? 'var(--ink, #1B1B1B)' :
                    daysLeft < 0     ? 'var(--st-bad-tx, #b03826)' :
                    daysLeft < 90    ? 'var(--st-warn-tx, #8a6418)' :
                    'var(--ink, #1B1B1B)';
                  return (
                    <tr key={c.contract_id} style={{ borderBottom: '1px solid var(--hairline-soft, #F0EDE3)' }}>
                      <td style={td}>
                        <Link
                          href={`/sales/b2b/partner/${encodeURIComponent(c.contract_id)}`}
                          style={{ color: 'var(--ink, #1B1B1B)', fontWeight: 600, textDecoration: 'none' }}
                        >
                          {c.partner_short_name}
                        </Link>
                      </td>
                      <td style={td}>{c.partner_type}</td>
                      <td style={td}>{c.country_flag ?? ''} {c.country ?? '—'}</td>
                      <td style={{ ...td, textTransform: 'capitalize', color: c.status === 'expired' ? 'var(--st-bad-tx, #b03826)' : c.status === 'expiring' ? 'var(--st-warn-tx, #8a6418)' : 'var(--ink, #1B1B1B)' }}>
                        {c.status}
                      </td>
                      <td style={td}>{c.contact_name ?? '—'}{c.contact_role ? ` · ${c.contact_role}` : ''}</td>
                      <td style={td}>
                        {c.contact_email && <div><a href={`mailto:${c.contact_email}`} style={{ color: 'var(--primary, #1F3A2E)' }}>{c.contact_email}</a></div>}
                        {c.contact_phone && <div style={{ color: 'var(--ink-soft, #5A5A5A)' }}>{c.contact_phone}</div>}
                        {!c.contact_email && !c.contact_phone && '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {c.commission_pct != null && Number(c.commission_pct) > 0
                          ? `${Number(c.commission_pct).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {c.group_surcharge_pct != null && Number(c.group_surcharge_pct) > 0
                          ? `${Number(c.group_surcharge_pct).toFixed(0)}%`
                          : '—'}
                      </td>
                      <td style={td}>{fmtDate(c.signed_date)}</td>
                      <td style={{ ...td, color: expiryColor, fontWeight: daysLeft != null && daysLeft < 90 ? 600 : 400 }}>
                        {fmtDate(c.expiry_date)}
                        {daysLeft != null && (
                          <div style={{ fontSize: 10, color: expiryColor, opacity: 0.85 }}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <Link
                          href={`/sales/b2b/partner/${encodeURIComponent(c.contract_id)}`}
                          style={{ fontSize: 11, color: 'var(--primary, #1F3A2E)', textDecoration: 'underline' }}
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </DashboardPage>
  );
}

const th: React.CSSProperties = {
  padding: '8px 10px',
  fontFamily: 'var(--mono, monospace)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--ink-soft, #5A5A5A)',
  fontWeight: 600,
};

const td: React.CSSProperties = {
  padding: '10px',
  verticalAlign: 'top',
  color: 'var(--ink, #1B1B1B)',
};
