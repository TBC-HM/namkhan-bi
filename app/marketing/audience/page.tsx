// app/marketing/audience/page.tsx
// PBS 2026-07-21 · Phase 2 — Unified people directory.
// Design: paper white (#FFFFFF) — never var(--paper-warm) per Namkhan token burn.
//
// 2026-07-21 evening · Audience upgrade v2:
//   1. Sub-strip [Audience · Scrape Engine] wraps AudienceUnifiedClient + ScrapeEngineTab.
//   2. Server pre-scopes both source= and tab= from searchParams.
//      Legacy /marketing/prospects/scrape 302-redirects to /marketing/audience?tab=scrape.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import AudienceSubTabsWrapper from './_components/AudienceSubTabsWrapper';
import type { AudienceRow, GroupRow } from './_components/AudienceUnifiedClient';

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

  const sp = (await searchParams) ?? {};
  const initialSource =
    (sp.source === 'subscribers' || sp.source === 'prospects') ? sp.source : 'all';
  const initialTab = sp.tab === 'scrape' ? 'scrape' : 'audience';

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/audience',
  }));

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Audience"
        subtitle="Unified people directory — subscribers + prospects + scrape engine."
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <AudienceSubTabsWrapper
            initialRows={rows}
            initialGroups={groups}
            initialSource={initialSource}
            initialTab={initialTab}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
