// app/settings/marketing/listings/page.tsx
// PBS 2026-07-03: master table for REPUTATION-category external listings only.
// Social channels (IG/FB/TikTok/YouTube) will live in a future marketing area.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { SETTINGS_SUBPAGES } from '@/app/settings/_subpages';
import ListingsEditor from './_components/ListingsEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ListingsPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_external_listings')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .in('category', ['reputation','pms','website'])
    .order('category').order('channel');
  const rows = (data as any[]) ?? [];

  const tabs: DashboardTab[] = SETTINGS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/settings/marketing/listings',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="External listings"
        subtitle="Reputation channels + PMS + website. Auto-syncs to review scraper and Google integration. Social channels (Instagram, Facebook, TikTok, YouTube) will move to a Marketing area later."
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1' }}>
          <ListingsEditor initial={rows} />
        </div>
      </DashboardPage>
    </div>
  );
}
