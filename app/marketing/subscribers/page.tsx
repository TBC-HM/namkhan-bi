// app/marketing/subscribers/page.tsx
// PBS 2026-07-16 — Newsletter subscribers directory. Opt-in-managed list.
// Data: marketing.newsletter_subscribers via bridge view public.v_marketing_subscribers.
// Writes via public.fn_subscriber_* RPCs (SECURITY DEFINER — PostgREST-public-only rule).
//
// GDPR: unconfirmed rows CANNOT be blasted. Column "Opted in?" is the consent gate.
// Design: paper white (#FFFFFF) — never var(--paper-warm) per Namkhan token burn.
//
// 2026-07-21 — added subscriber groups (FIT/BTB/DMC + custom). One tile per group
// in the KPI strip · v_subscriber_groups seeds server-side member_count.
//
// 2026-07-21 (pm) — /marketing/contacts consolidated into this page as the
// "Candidates pool" tab. Extra loaders below fetch the full v_gmail_contacts
// (top 500 by message_count, both internal + external) and top-10 domains.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import SubscribersClient, {
  type SubscriberRow,
  type ScrapeEventRow,
  type GmailContactRow,
  type GroupRow,
  type ContactRow,
  type DomainRow,
} from './_components/SubscribersClient';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export default async function SubscribersPage() {
  const sb = getSupabaseAdmin();

  const subsQ = await sb
    .from('v_marketing_subscribers')
    .select('id, email, name, tags, source, opted_in_at, unsubscribed_at, bounced_at, notes, created_at, updated_at, is_active, group_slugs')
    .order('created_at', { ascending: false })
    .limit(5000);
  const subscribers: SubscriberRow[] = (subsQ.data ?? []) as SubscriberRow[];

  // Gmail candidates for import panel — top 200 external by message_count.
  const gmailQ = await sb
    .from('v_gmail_contacts')
    .select('email, display_name, message_count, domain, last_seen_at, is_internal')
    .eq('is_internal', false)
    .order('message_count', { ascending: false })
    .limit(200);
  const gmailCandidates: GmailContactRow[] = (gmailQ.data ?? []) as GmailContactRow[];

  // Recent web scrapes (last 20)
  const scrapesQ = await sb
    .from('v_marketing_web_scrape_events')
    .select('id, url, title, target, tags, emails_found, summary, lead_id, subscriber_ids, created_at')
    .limit(20);
  const scrapeEvents: ScrapeEventRow[] = (scrapesQ.data ?? []) as ScrapeEventRow[];

  // Subscriber groups (FIT / BTB / DMC + custom) — server-side member_count.
  const groupsQ = await sb
    .from('v_subscriber_groups')
    .select('*')
    .order('sort_order', { ascending: true });
  const initialGroups: GroupRow[] = (groupsQ.data ?? []) as GroupRow[];

  // Candidates pool payload (merged in from ex-/marketing/contacts page):
  //   • top 500 v_gmail_contacts (both internal + external — filters live client-side)
  //   • top 10 external domains
  const allContactsQ = await sb
    .from('v_gmail_contacts')
    .select('email, display_name, first_seen_at, last_seen_at, message_count, direction_mix, source_accounts, domain, is_internal, updated_at')
    .order('message_count', { ascending: false })
    .limit(500);
  const allContacts: ContactRow[] = (allContactsQ.data ?? []) as ContactRow[];

  const domainsQ = await sb
    .from('v_gmail_contact_domains')
    .select('domain, contact_count, total_messages, most_recent')
    .limit(10);
  const topDomains: DomainRow[] = (domainsQ.data ?? []) as DomainRow[];

  const totalActive = subscribers.filter((s) => !!s.opted_in_at && !s.unsubscribed_at).length;
  const totalUnsub  = subscribers.filter((s) => !!s.unsubscribed_at).length;
  const totalBounced = subscribers.filter((s) => !!s.bounced_at).length;
  const totalPending = subscribers.filter((s) => !s.opted_in_at && !s.unsubscribed_at).length;
  const total = subscribers.length;
  const optInRate = total > 0 ? Math.round((totalActive / total) * 100) : 0;

  // Top 3 tags
  const tagCounts: Record<string, number> = {};
  for (const s of subscribers) {
    for (const t of s.tags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const baseTiles: KpiTileProps[] = [
    { label: 'Total active',       value: totalActive.toLocaleString(), size: 'sm', status: totalActive > 0 ? 'green' : undefined, footnote: 'opted-in and not unsubscribed' },
    { label: 'Opt-in rate',        value: optInRate + '%',              size: 'sm', footnote: totalPending + ' pending confirm' },
    { label: 'Unsubscribed',       value: totalUnsub.toLocaleString(),  size: 'sm', footnote: 'excluded from sends' },
    { label: 'Bounced',            value: totalBounced.toLocaleString(),size: 'sm', status: totalBounced > 0 ? 'red' : undefined, footnote: 'hard-bounced' },
    {
      label: 'Top tags',
      value: topTags.length > 0 ? topTags.map(([t, c]) => t + ' ' + c).join(' · ') : '—',
      size: 'sm',
      footnote: 'click a chip below to filter',
    },
  ];

  // One tile per group (server-side member_count).
  const groupTiles: KpiTileProps[] = initialGroups.map((g) => ({
    label: g.name,
    value: (g.member_count ?? 0).toLocaleString(),
    size: 'sm',
    footnote: g.is_system ? 'system group' : 'custom group',
  }));

  const tiles: KpiTileProps[] = [...baseTiles, ...groupTiles];

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/subscribers',
  }));

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Subscribers"
        subtitle={`${totalActive.toLocaleString()} active · ${totalPending.toLocaleString()} pending confirm · ${totalUnsub.toLocaleString()} unsubscribed · ${allContacts.length.toLocaleString()} Gmail candidates`}
        tabs={tabs}
      >
        {/* GDPR banner */}
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
          <strong style={{ color: '#1B1B1B' }}>GDPR:</strong> unconfirmed subscribers cannot be blasted — send an opt-in campaign first.
          The <em>Opted in?</em> column shows consent status. New imports always start unconfirmed (opted_in_at = NULL).
        </div>

        {/* KPI strip (base + group tiles) */}
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
          <SubscribersClient
            initialSubscribers={subscribers}
            gmailCandidates={gmailCandidates}
            scrapeEvents={scrapeEvents}
            initialGroups={initialGroups}
            allContacts={allContacts}
            topDomains={topDomains}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
