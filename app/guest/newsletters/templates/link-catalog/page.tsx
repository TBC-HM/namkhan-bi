// app/guest/newsletters/templates/link-catalog/page.tsx
// PBS 2026-07-21 · Manage internal link catalog for the Composer link picker.
// Reads via schema('marketing').from('internal_link_catalog') on the server;
// writes via /api/marketing/link-catalog/{upsert,delete,scrape-website}.

import type { DashboardTab } from '@/app/(cockpit)/_design';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import NewslettersSubStrip from '../../_components/NewslettersSubStrip';
import LinkCatalogClient, { type LinkRow } from './_components/LinkCatalogClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps { propertyId?: number }

export default async function LinkCatalogPage({ propertyId }: PageProps = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .schema('marketing')
    .from('internal_link_catalog')
    .select('*')
    .eq('property_id', pid)
    .order('is_pinned', { ascending: false })
    .order('id', { ascending: true });

  const rows: LinkRow[] = (data ?? []) as LinkRow[];

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Contacts · Newsletters · Templates · Link Catalog"
        subtitle={`${rows.length} link${rows.length===1?'':'s'} available to the Composer link picker.`}
        tabs={tabs}
      >
        <NewslettersSubStrip active="templates" />
        {error && (
          <div style={{ gridColumn:'1 / -1', padding:12, border:'1px solid #B03826', background:'#FBEDE7', color:'#B03826', fontSize:12, borderRadius:3 }}>
            Could not load link catalog: {error.message}
          </div>
        )}
        <div style={{ gridColumn:'1 / -1' }}>
          <LinkCatalogClient propertyId={pid} initialRows={rows} />
        </div>
      </DashboardPage>
    </div>
  );
}
