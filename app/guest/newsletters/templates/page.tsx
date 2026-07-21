// app/guest/newsletters/templates/page.tsx
// PBS 2026-07-21: Manage Templates page under /guest/newsletters/templates.
// Mounted as the 3rd sub-tab (Newsletters · Sequences · Templates).
// Reads via public.v_newsletter_templates bridge view.
// Writes via public.fn_newsletter_template_save / fn_newsletter_template_delete RPCs.

import type { DashboardTab } from '@/app/(cockpit)/_design';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import NewslettersSubStrip from '../_components/NewslettersSubStrip';
import TemplatesClient, { type TemplateRow, type MediaRow } from './_components/TemplatesClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps { propertyId?: number }

export default async function TemplatesPage({ propertyId }: PageProps = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const sb = getSupabaseAdmin();

  const [templatesRes, mediaRes] = await Promise.all([
    sb.from('v_newsletter_templates').select('*').eq('property_id', pid).order('template_key'),
    sb.from('v_marketing_media_page')
      .select('asset_id, original_filename, public_url, quality_index, primary_tier, category')
      .eq('asset_type', 'photo')
      .not('public_url', 'is', null)
      .order('quality_index', { ascending: false, nullsFirst: false })
      .limit(500),
  ]);

  const templates: TemplateRow[] = (templatesRes.data ?? []) as TemplateRow[];
  const media: MediaRow[] = (mediaRes.data ?? []) as MediaRow[];

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Contacts · Newsletters · Templates"
        subtitle={`${templates.length} template${templates.length===1?'':'s'} — reusable body + subject + hero for newsletters and sequences.`}
        tabs={tabs}
      >
        <NewslettersSubStrip active="templates" />
        {templatesRes.error && (
          <div style={{ gridColumn:'1 / -1', padding:12, border:'1px solid #B03826', background:'#FBEDE7', color:'#B03826', fontSize:12, borderRadius:3 }}>
            Could not load templates: {templatesRes.error.message}
          </div>
        )}
        <div style={{ gridColumn:'1 / -1' }}>
          <TemplatesClient
            propertyId={pid}
            initialTemplates={templates}
            initialMedia={media}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
