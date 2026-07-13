// app/marketing/media/page.tsx
// PBS 2026-07-13 · Video AI Studio v1 — loads v_video_style_presets +
// v_video_music_tracks for VideoSettingsTab.
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
    rooms, facilities, facilitiesRaw, activitiesRaw, transportRaw, boatsRaw, cruisesRaw,
    videoTemplates, videoBriefs, pillars, coverageMatrix,
    stylePresets, musicTracks,
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
    sb.schema('property' as any).from('facilities').select('facility_id, name, parent_facility_id, is_meeting_space').eq('property_id', pid).eq('is_active', true).order('name'),
    sb.schema('property' as any).from('activities').select('activity_id, name, facility_id').eq('property_id', pid).eq('is_active', true).order('name'),
    sb.schema('property' as any).from('transport_options').select('transport_id, name, transport_type, route_from, route_to').eq('property_id', pid).eq('is_active', true).order('name'),
    sb.schema('property' as any).from('boats').select('boat_id, name, model, capacity_pax').eq('property_id', pid).eq('is_active', true).order('name'),
    sb.schema('property' as any).from('boat_cruises').select('cruise_id, name, boat_id, cruise_type, route_from, route_to').eq('property_id', pid).eq('is_active', true).order('name'),
    sb.from('v_video_templates').select('*').order('sort_order', { ascending: true }),
    sb.from('v_marketing_video_briefs').select('*').eq('property_id', pid).order('created_at', { ascending: false }),
    sb.from('v_yt_content_pillars').select('pillar_key, label').eq('property_id', pid).eq('active', true).order('sort_order', { ascending: true }),
    sb.from('v_media_coverage_matrix').select('scope_label, scope_type, scope_key, property_id, primary_tier, n').eq('property_id', pid),
    // Video AI Studio v1 (2026-07-13):
    sb.from('v_video_style_presets').select('*').or(`property_id.is.null,property_id.eq.${pid}`),
    sb.from('v_video_music_tracks').select('*').order('created_at', { ascending: false }).limit(100),
  ]);

  const facilityRows = (facilitiesRaw.data ?? []) as Array<{ facility_id: number; name: string; parent_facility_id: number | null; is_meeting_space: boolean | null }>;
  const facByPk = new Map<number, string>();
  for (const f of facilityRows) facByPk.set(f.facility_id, f.name);
  const meetingSpaces = facilityRows.filter(f => f.is_meeting_space).map(f => ({ id: f.facility_id, name: f.name }));
  const nonMeetingFacilities = facilityRows.filter(f => !f.is_meeting_space).map(f => ({
    id: f.facility_id, name: f.name,
    parent_id: f.parent_facility_id,
    parent_name: f.parent_facility_id ? (facByPk.get(f.parent_facility_id) ?? null) : null,
  }));
  const taxonomy = {
    rooms: (rooms.data ?? []).map((r: any) => ({ id: r.room_type_id, name: r.room_type_name })),
    facilities: nonMeetingFacilities,
    activities: (activitiesRaw.data ?? []).map((a: any) => ({ id: a.activity_id, name: a.name, facility_id: a.facility_id, facility_name: a.facility_id ? (facByPk.get(a.facility_id) ?? null) : null })),
    meeting_spaces: meetingSpaces,
    transport: (transportRaw.data ?? []).map((t: any) => ({ id: t.transport_id, name: t.name, kind: t.transport_type, route_from: t.route_from, route_to: t.route_to })),
    boats: (boatsRaw.data ?? []).map((b: any) => ({ id: b.boat_id, name: b.name, model: b.model, capacity_pax: b.capacity_pax })),
    boat_cruises: (cruisesRaw.data ?? []).map((c: any) => {
      const boat = (boatsRaw.data ?? []).find((b: any) => b.boat_id === c.boat_id);
      return { id: c.cruise_id, name: c.name, boat_name: boat?.name ?? null, kind: c.cruise_type, route_from: c.route_from, route_to: c.route_to };
    }),
  };

  const areaSet = new Set<string>();
  areaSet.add('Logos'); areaSet.add('No area');
  for (const r of taxonomy.rooms)          areaSet.add(r.name);
  for (const f of taxonomy.facilities)     areaSet.add(f.name);
  for (const a of taxonomy.activities)     areaSet.add(a.name);
  for (const m of taxonomy.meeting_spaces) areaSet.add(m.name);
  for (const t of taxonomy.transport)      areaSet.add(t.name);
  for (const b of taxonomy.boats)          areaSet.add(b.name);
  for (const c of taxonomy.boat_cruises)   areaSet.add(c.name);
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
    taxonomy,
    areaOptions,
    videoTemplates: videoTemplates.data ?? [],
    videoBriefs: videoBriefs.data ?? [],
    pillars: pillars.data ?? [],
    coverageRows: coverageMatrix.data ?? [],
    stylePresets: stylePresets.data ?? [],
    musicTracks: musicTracks.data ?? [],
    errors: [
      byTier.error, mediaPage.error, channelSpecs.error, rulesActive.error,
      aiGens.error, videoEdits.error, reality.error, categories.error,
      rooms.error, facilities.error, facilitiesRaw.error, activitiesRaw.error, transportRaw.error,
      boatsRaw.error, cruisesRaw.error, videoTemplates.error, videoBriefs.error, pillars.error,
      coverageMatrix.error, stylePresets.error, musicTracks.error,
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
            taxonomy={data.taxonomy as any}
            areaOptions={data.areaOptions}
            videoTemplates={data.videoTemplates as any}
            videoBriefs={data.videoBriefs as any}
            pillars={data.pillars as any}
            coverageRows={data.coverageRows as any}
            stylePresets={data.stylePresets as any}
            musicTracks={data.musicTracks as any}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
