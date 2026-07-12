// app/marketing/media/page.tsx
// PBS 2026-07-12 — Media Hub (brief media-ai-video-ui).
// Server component. Loads server-side, renders <MediaHub/> client.
// Sub-tabs: Library · AI Studio · Video · Clarify · Settings.
// 2026-07-11 pm: added categories fetch (v_ai_prompt_categories) for AI Studio dropdown + Settings tab.
// 2026-07-12: derives distinct property_area values for the Edit drawer datalist.
// 2026-07-12 pm: added rooms + facilities grounding — pipes v_room_grounding + v_facility_grounding
//   into AiStudioTab (category-driven dropdowns) and SettingsTab (Reality profile companion panels).
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import MediaHub from './_client/MediaHub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN_PROPERTY_ID = 260955;

async function loadAll(pid: number) {
  const sb = getSupabaseAdmin();
  const [
    byTier, mediaPage, channelSpecs, rulesActive, aiGens, videoEdits, reality, categories,
    rooms, facilities,
  ] = await Promise.all([
    sb.from('mkt_v_media_by_tier').select('*'),
    sb.from('v_marketing_media_page').select('*').limit(500),
    sb.from('v_media_channel_specs').select('*'),
    sb.from('v_media_rules_active').select('*'),
    sb.from('v_ai_generations').select('*').order('created_at', { ascending: false }).limit(50),
    sb.from('v_video_edits').select('*').order('created_at', { ascending: false }).limit(50),
    sb.from('v_reality_profile').select('*').eq('property_id', pid).maybeSingle(),
    sb.from('v_ai_prompt_categories').select('*')
      .or(`property_id.is.null,property_id.eq.${pid}`)
      .order('sort_order', { ascending: true }),
    sb.from('v_room_grounding').select('*').eq('property_id', pid).order('room_type_id', { ascending: true }),
    sb.from('v_facility_grounding').select('*').eq('property_id', pid).eq('active', true).order('sort_order', { ascending: true }),
  ]);

  const areaSet = new Set<string>();
  // (a) canonical always-visible options
  areaSet.add('Logos');
  areaSet.add('No area');
  // (b) all room names — from v_room_grounding load
  for (const r of (rooms.data ?? [])) {
    const n = (r as any).room_type_name;
    if (n && typeof n === 'string') areaSet.add(n);
  }
  // (c) all facility names — from v_facility_grounding load
  for (const f of (facilities.data ?? [])) {
    const n = (f as any).facility_name;
    if (n && typeof n === 'string') areaSet.add(n);
  }
  // (d) any historical values already tagged in library
  for (const row of (mediaPage.data ?? [])) {
    const v = (row as any).property_area;
    if (v && typeof v === 'string') areaSet.add(v);
  }
  const areaOptions = Array.from(areaSet).sort((a, b) => a.localeCompare(b));

  return {
    byTier: byTier.data ?? [],
    mediaPage: mediaPage.data ?? [],
    channelSpecs: channelSpecs.data ?? [],
    rulesActive: rulesActive.data ?? [],
    aiGens: aiGens.data ?? [],
    videoEdits: videoEdits.data ?? [],
    reality: reality.data ?? null,
    categories: categories.data ?? [],
    rooms: rooms.data ?? [],
    facilities: facilities.data ?? [],
    areaOptions,
    errors: [
      byTier.error, mediaPage.error, channelSpecs.error, rulesActive.error,
      aiGens.error, videoEdits.error, reality.error, categories.error,
      rooms.error, facilities.error,
    ].filter(Boolean),
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
        subtitle={errorMsg ?? `Library · AI Studio · Video · Clarify · Settings — property ${pid}`}
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
            categories={data.categories as any}
            rooms={data.rooms as any}
            facilities={data.facilities as any}
            areaOptions={data.areaOptions}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
