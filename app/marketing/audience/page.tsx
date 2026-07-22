// app/marketing/audience/page.tsx
// PBS 2026-07-21 · Phase 2 — Unified people directory.
// Reads public.v_marketing_audience (subscribers UNION prospects) + v_subscriber_groups.
// Pre-scopes filter state from ?source= / ?tab= searchParams.
// Design: paper white (#FFFFFF) — never var(--paper-warm) per Namkhan token burn.
//
// 2026-07-21 pm · Tiles now also read purged_bounced + purged_unsubscribed from
// public.v_marketing_audience_tiles so the headline strip shows the auto-purge status.
//
// 2026-07-22 · Chunked .range() fetch replaces .limit(3000) — PostgREST caps at 1000
// silently, so prospects (sorted after subscribers by created_at) never loaded and the
// PROSPECTS tile click showed "No rows match filters" for a 1,224-row group.
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

async function fetchAllAudience(sb: ReturnType<typeof getSupabaseAdmin>): Promise<AudienceRow[]> {
  const CHUNK = 1000;
  const HARD_CAP = 20000;
  const out: AudienceRow[] = [];
  let offset = 0;
  while (offset < HARD_CAP) {
    const { data, error } = await sb
      .from('v_marketing_audience')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + CHUNK - 1);
    if (error) {
      console.error('[audience] chunk fetch failed at offset', offset, error);
      break;
    }
    const chunk = (data ?? []) as AudienceRow[];
    out.push(...chunk);
    if (chunk.length < CHUNK) break;
    offset += CHUNK;
  }
  return out;
}

export default async function AudienceUnifiedPage({ searchParams }: PageProps) {
  const sb = getSupabaseAdmin();

  const rows = await fetchAllAudience(sb);

  const groupsQ = await sb
    .from('v_subscriber_groups')
    .select('id, slug, name, description, color, is_system, sort_order, member_count')
    .order('sort_order', { ascending: true });
  const groups: GroupRow[] = (groupsQ.data ?? []) as GroupRow[];

  // Authoritative tile counts — bypasses the row cap so tiles never look stale.
  const tilesQ = await sb
    .from('v_marketing_audience_tiles')
    .select('total_subs, mailable, guests_sea, guests_int, returning_guests, dmc, responders, prospects, purged_bounced, purged_unsubscribed')
    .maybeSingle();
  const initialTiles: AudienceTiles = (tilesQ.data as AudienceTiles) ?? {
    total_subs: 0, mailable: 0, guests_sea: 0, guests_int: 0, returning_guests: 0,
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
