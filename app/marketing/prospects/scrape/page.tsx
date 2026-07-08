// app/marketing/prospects/scrape/page.tsx
// PBS 2026-07-06: Scrape page — actor picker + prior-run history (avoids duplicate scrapes).
import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import ScrapeForm from './_components/ScrapeForm';
import ScrapeHistory from './_components/ScrapeHistory';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export type ScrapeLogRow = {
  id: number;
  actor: string;
  slug: string;
  input_summary: string | null;
  tag_hints: string[] | null;
  items_returned: number;
  inserted: number;
  skipped: number;
  tags_applied: number;
  duration_ms: number | null;
  ok: boolean;
  error: string | null;
  created_at: string;
};

export default async function ScrapePage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('apify_scrape_log')
    .select('id, actor, slug, input_summary, tag_hints, items_returned, inserted, skipped, tags_applied, duration_ms, ok, error, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  const history: ScrapeLogRow[] = (data as ScrapeLogRow[]) ?? [];

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/prospects',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Marketing · Prospects · Scrape"
        subtitle="Pick an actor · enter keywords or URLs · results land in prospects automatically"
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1' }}>
          <TenantLink href="/marketing/prospects" style={{ fontSize:12, color:'#084838', textDecoration:'none', fontWeight:600 }}>
            ← Back to prospects
          </TenantLink>
        </div>

        <div style={{ gridColumn:'1 / -1' }}>
          <ScrapeForm recentHistory={history.slice(0, 20)} />
        </div>

        <div style={{ gridColumn:'1 / -1' }}>
          <ScrapeHistory rows={history} />
        </div>
      </DashboardPage>
    </div>
  );
}