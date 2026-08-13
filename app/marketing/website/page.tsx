// app/marketing/website/page.tsx
// website-module-v1 P3 (2026-07-30, standing builder) — Marketing → Website capability.
// Management surface over website.* content rows (ADR-191 content-as-rows).
// Reads via public.v_website_* bridges; writes ONLY via /api/website/* routes
// (public.fn_website_* SECURITY DEFINER bridges, audited). Publish snapshots
// siteData as a versioned build artifact and fires the host-agnostic deploy
// hook (env key from website.sites.deploy_hook_key) once the site repo exists.
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import WebsiteManager, { type WebsiteInitialData } from './WebsiteManager';
import NavEditor from './_components/NavEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MarketingWebsitePage() {
  const sb = getSupabaseAdmin();
  const pid = PROPERTY_ID;

  const [site, pages, settings, artifacts, sectionCounts] = await Promise.all([
    sb.from('v_website_sites').select('*').eq('property_id', pid).maybeSingle(),
    sb.from('v_website_pages').select('*').eq('property_id', pid)
      .order('nav_order', { ascending: true, nullsFirst: false })
      .order('slug', { ascending: true }),
    sb.from('v_website_settings').select('*').eq('property_id', pid).order('key'),
    sb.from('v_website_build_artifacts').select('*').eq('property_id', pid)
      .order('created_at', { ascending: false }).limit(10),
    sb.from('v_website_sections').select('page_id').eq('property_id', pid),
  ]);

  const sectionsByPage: Record<number, number> = {};
  for (const row of sectionCounts.data ?? []) {
    const k = Number((row as { page_id: number }).page_id);
    sectionsByPage[k] = (sectionsByPage[k] ?? 0) + 1;
  }

  const initial: WebsiteInitialData = {
    propertyId: pid,
    site: site.data ?? null,
    pages: pages.data ?? [],
    settings: settings.data ?? [],
    artifacts: artifacts.data ?? [],
    sectionsByPage,
    loadError: site.error?.message || pages.error?.message || null,
  };

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
  }));

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Website"
        subtitle="Content-as-rows source of truth for the public site — edit, then publish to regenerate siteData"
        tabs={tabs}
      >
        <WebsiteManager initial={initial} />
        <NavEditor />
      </DashboardPage>
    </div>
  );
}
