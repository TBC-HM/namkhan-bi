// app/guest/newsletters/[campaign_id]/preview/page.tsx
// PBS 2026-07-04 v6: Send-test card at top.
// PBS 2026-07-23 v7: renders through THE canonical renderer
// (lib/emailRenderer.renderNewsletterEmail) inside an iframe srcDoc — the exact
// HTML the send edge functions produce. Chrome is fetched from
// v_marketing_property_email_settings; personalization tokens stay visible.

import TenantLink from '@/components/nav/TenantLink';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { renderNewsletterEmail, chromeFromSettingsRow } from '@/lib/emailRenderer';
import SendTestCard from './_components/SendTestCard';
import AdHocDispatchDrawer from './_components/AdHocDispatchDrawer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { campaign_id: string }; }

export default async function CampaignPreviewPage({ params }: Props) {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('guest').from('campaigns')
    .select('*').eq('campaign_id', params.campaign_id).maybeSingle();
  if (!data) notFound();
  const c = data as { property_id: number; campaign_id: string; status: string; subject: string | null; body_md: string | null; name: string | null };
  if (c.property_id !== PROPERTY_ID) notFound();

  const { data: settings } = await sb.from('v_marketing_property_email_settings')
    .select('*').eq('property_id', PROPERTY_ID).maybeSingle();

  const html = renderNewsletterEmail({
    subjectForTitle: c.subject || c.name || 'Newsletter',
    bodyMd: c.body_md ?? '',
    chrome: chromeFromSettingsRow(settings),
    mode: 'full',
  });

  const INK='#1B1B1B'; const INK_M='#5A5A5A'; const NK_GREEN='#084838'; const HAIR='#E6DFCC';

  return (
    <div style={{ background:'#FAF7EE', minHeight:'100vh', padding:'32px 24px' }}>
      <div style={{ maxWidth: 680, margin:'0 auto' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, fontSize:11, color:INK_M }}>
          <TenantLink href="/guest/newsletters" style={{ color:INK_M, textDecoration:'none' }}>← Back to overview</TenantLink>
          <div>
            <span>Status: <strong style={{ color:INK }}>{c.status}</strong></span>
            <span style={{ margin:'0 8px' }}>·</span>
            <TenantLink href={`/guest/newsletters/${c.campaign_id}`} style={{ color:NK_GREEN, fontWeight:600, textDecoration:'none' }}>Edit →</TenantLink>
          </div>
        </div>

        {/* Send-test card + ad-hoc dispatch drawer trigger */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <SendTestCard campaign_id={c.campaign_id} />
          </div>
          <AdHocDispatchDrawer campaign_id={c.campaign_id} campaign_name={c.name || 'Newsletter'} />
        </div>

        <div style={{ background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:4, overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ padding:'8px 12px', background:'#F5F0E1', borderBottom:'1px solid '+HAIR, fontSize:11, color:INK_M }}>
            Subject: <strong style={{ color:INK }}>{c.subject || '(no subject)'}</strong>
            <span style={{ marginLeft:8, color:INK_M }}>· canonical render — identical to the sent email</span>
          </div>
          <iframe title="newsletter-preview" srcDoc={html}
            style={{ width:'100%', height:1400, border:'none', background:'#FFFFFF', display:'block' }} />
        </div>
      </div>
    </div>
  );
}
