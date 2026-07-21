// app/marketing/audience/page.tsx
// PBS 2026-07-21 · Phase 2 — Unified people directory.
// Replaces the phase-1 link-card hub. Reads public.v_marketing_audience (subscribers UNION prospects)
// plus v_subscriber_groups. Pre-scopes filter state from ?source= / ?tab= searchParams.
// Design: paper white (#FFFFFF) — never var(--paper-warm) per Namkhan token burn.
//
// 2026-07-21 pm · Tiles now also read purged_bounced + purged_unsubscribed from
// public.v_marketing_audience_tiles so the headline strip shows the auto-purge status
// alongside the mailable universe.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import AudienceUnifiedClient, {
  type AudienceRow,
  type AudienceTiles,
  type GroupRow,
} from './_components/AudienceUnifiedClient';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

interface PageProps {
  searchParams?: Promise<{ source?: string; tab?: string }>;
}

export default async function AudienceUnifiedPage({ searchParams }: PageProps) {
  const sb = getSupabaseAdmin();

  const audienceQ = await sb
    .from('v_marketing_audience')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(3000);
  const rows: AudienceRow[] = (audienceQ.data ?? []) as AudienceRow[];

  const groupsQ = await sb
    .from('v_subscriber_groups')
    .select('id, slug, name, description, color, is_system, sort_order, member_count')
    .order('sort_order', { ascending: true });
  const groups: GroupRow[] = (groupsQ.data ?? []) as GroupRow[];

  // Authoritative tile counts — bypasses the 3000-row rows[] cap so tiles
  // never look stale on large audiences. Fed by public.v_marketing_audience_tiles.
  // Also surfaces purged_bounced + purged_unsubscribed (marketing.subscriber_blocklist).
  const tilesQ = await sb
    .from('v_marketing_audience_tiles')
    .select('total_subs, mailable, guests, returning_guests, dmc, responders, prospects, purged_bounced, purged_unsubscribed')
    .maybeSingle();
  const initialTiles: AudienceTiles = (tilesQ.data as AudienceTiles) ?? {
    total_subs: 0, mailable: 0, guests: 0, returning_guests: 0,
    dmc: 0, responders: 0, prospects: 0,
    purged_bounced: 0, purged_unsubscribed: 0,
  };

  const sp = (await searchParams) ?? {};
  const initialSource = (sp.source === 'subscribers' || sp.source === 'prospects') ? sp.source : 'all';
  const initialTab    = sp.tab === 'scrape' ? 'scrape' : 'table';

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/audience',
  }));

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Audience"
        subtitle="Unified people directory — subscribers + prospects in one table."
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <AudienceUnifiedClient
            initialRows={rows}
            initialGroups={groups}
            initialSource={initialSource}
            initialTab={initialTab}
            initialTiles={initialTiles}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
