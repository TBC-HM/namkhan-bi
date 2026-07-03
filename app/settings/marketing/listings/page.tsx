// app/settings/marketing/listings/page.tsx
// PBS 2026-07-03: master table for every external listing / URL / handle.

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
    .select('*').eq('property_id', PROPERTY_ID).order('channel');
  const rows = (data as any[]) ?? [];

  const tabs: DashboardTab[] = SETTINGS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/settings/marketing/listings',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="External listings"
        subtitle="One place to store every listing URL, admin URL, external ID and social handle. Auto-syncs to review scraper + Google integration + newsletter footer."
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1' }}>
          <ListingsEditor initial={rows} />
        </div>
      </DashboardPage>
    </div>
  );
}
