// app/marketing/media/page.tsx
// PBS 2026-07-12 — Media Hub (brief media-ai-video-ui).
// Server component. Loads server-side, renders <MediaHub/> client.
// Sub-tabs: Library · AI Studio · Video · Settings.
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import MediaHub from './_client/MediaHub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN_PROPERTY_ID = 260955;

async function loadAll(pid: number) {
  const sb = getSupabaseAdmin();
  const [byTier, mediaPage, channelSpecs, rulesActive, aiGens, videoEdits, reality] = await Promise.all([
    sb.from('mkt_v_media_by_tier').select('*'),
    sb.from('v_marketing_media_page').select('*').limit(500),
    sb.from('v_media_channel_specs').select('*'),
    sb.from('v_media_rules_active').select('*'),
    sb.from('v_ai_generations').select('*').order('created_at', { ascending: false }).limit(50),
    sb.from('v_video_edits').select('*').order('created_at', { ascending: false }).limit(50),
    sb.from('v_reality_profile').select('*').eq('property_id', pid).maybeSingle(),
  ]);
  return {
    byTier: byTier.data ?? [],
    mediaPage: mediaPage.data ?? [],
    channelSpecs: channelSpecs.data ?? [],
    rulesActive: rulesActive.data ?? [],
    aiGens: aiGens.data ?? [],
    videoEdits: videoEdits.data ?? [],
    reality: reality.data ?? null,
    errors: [byTier.error, mediaPage.error, channelSpecs.error, rulesActive.error, aiGens.error, videoEdits.error, reality.error].filter(Boolean),
  };
}

interface Props { propertyId?: number }

export default async function MarketingMediaPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? NAMKHAN_PROPERTY_ID;
  const data = await loadAll(pid);

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/media',
  }));

  const errorMsg = data.errors.length ? `${data.errors.length} bridge error${data.errors.length===1?'':'s'} — check server logs` : null;

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Marketing · Media"
        subtitle={errorMsg ?? `Library · AI Studio · Video · Settings — property ${pid}`}
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <MediaHub
            propertyId={pid}
            byTier={data.byTier as any}
            mediaPage={data.mediaPage as any}
            channelSpecs={data.channelSpecs as any}
            rulesActive={data.rulesActive as any}
            aiGens={data.aiGens as any}
            videoEdits={data.videoEdits as any}
            reality={data.reality as any}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
