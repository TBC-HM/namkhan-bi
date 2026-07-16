// app/marketing/contacts/page.tsx
// PBS 2026-07-16 — Gmail contacts directory.
// Read-only view over marketing.gmail_contacts_extracted (via bridge view
// public.v_gmail_contacts). "Run extraction now" triggers /api/marketing/contacts/extract.
// "Add to Leads" per external row posts to /api/sales/leads/create.
//
// Design: paper-white per feedback_paper_white_default_for_tables + Namkhan token ladder.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import ContactsClient, { type ContactRow, type DomainRow, type RunRow } from './_components/ContactsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export default async function ContactsPage() {
  const sb = getSupabaseAdmin();

  // Top 500 by message_count for initial client-side filtering payload.
  const contactsQ = await sb
    .from('v_gmail_contacts')
    .select('email, display_name, first_seen_at, last_seen_at, message_count, direction_mix, source_accounts, domain, is_internal, updated_at')
    .order('message_count', { ascending: false })
    .limit(500);
  const contacts: ContactRow[] = ((contactsQ.data ?? []) as ContactRow[]);

  const domainsQ = await sb
    .from('v_gmail_contact_domains')
    .select('domain, contact_count, total_messages, most_recent')
    .limit(10);
  const topDomains: DomainRow[] = ((domainsQ.data ?? []) as DomainRow[]);

  const totalQ = await sb
    .from('v_gmail_contacts')
    .select('email', { count: 'exact', head: true });
  const total = totalQ.count ?? 0;

  const externalQ = await sb
    .from('v_gmail_contacts')
    .select('email', { count: 'exact', head: true })
    .eq('is_internal', false);
  const external = externalQ.count ?? 0;

  const internalQ = await sb
    .from('v_gmail_contacts')
    .select('email', { count: 'exact', head: true })
    .eq('is_internal', true);
  const internal = internalQ.count ?? 0;

  const runsQ = await sb
    .from('v_gmail_extract_runs')
    .select('id, started_at, finished_at, gmail_account, messages_scanned, new_contacts, updated_contacts, status, error_message')
    .limit(5);
  const runs: RunRow[] = ((runsQ.data ?? []) as RunRow[]);

  const lastRun = runs[0];
  const lastRunLabel = lastRun
    ? `${lastRun.gmail_account} · ${lastRun.status} · ${new Date(lastRun.started_at).toLocaleString()}`
    : 'never';

  const tiles: KpiTileProps[] = [
    { label: 'Total contacts', value: total.toLocaleString(), size: 'sm', footnote: 'unique emails ever seen' },
    { label: 'External',       value: external.toLocaleString(), size: 'sm', status: external > 0 ? 'green' : undefined, footnote: 'outside @thenamkhan.com' },
    { label: 'Internal',       value: internal.toLocaleString(), size: 'sm', footnote: '@thenamkhan.com staff' },
    { label: 'Top domains',    value: topDomains.length.toString(), size: 'sm', footnote: 'shown below' },
    { label: 'Last extraction', value: runs[0]?.status ?? '—', size: 'sm', status: runs[0]?.status === 'succeeded' ? 'green' : runs[0]?.status === 'failed' ? 'red' : undefined, footnote: lastRunLabel.slice(0, 60) },
  ];

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/contacts',
  }));

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Contacts"
        subtitle={`${total.toLocaleString()} unique addresses extracted from connected Gmail mailboxes (headers only)`}
        tabs={tabs}
      >
        <div
          style={{
            gridColumn: '1 / -1',
            padding: '8px 12px',
            fontSize: 11,
            color: '#5A5A5A',
            background: '#F5F0E1',
            border: '1px solid #E6DFCC',
            borderRadius: 4,
          }}
        >
          Extracted for internal reference. Marketing outreach requires opt-in — do not add to newsletters without consent.
        </div>

        <div
          style={{
            gridColumn: '1 / -1',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 8,
          }}
        >
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <ContactsClient
            initialContacts={contacts}
            topDomains={topDomains}
            initialRuns={runs}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
