// app/marketing/media/page.tsx
// PBS 2026-07-13 · Video AI Studio v1 — loads v_video_style_presets +
// v_video_music_tracks for VideoSettingsTab.
// PBS 2026-07-14 · Task A — mediaPage limit 500 -> 5000.
// PBS 2026-07-14 · Task B — loads 7 photo guardrails datasets.
// PBS 2026-07-14 · Task B follow-up — v_media_naming_conventions no longer
// filtered by scope so both photo AND video rules reach PhotoGuardrailsPanel.
// PBS 2026-07-17 · media-pipeline-frontend brief · SCOPE 2 — load
//   public.v_media_review_queue (all flagged, any status; ADR-149..152) so
//   the Review tab is no longer empty. Previously ReviewTab received no rows
//   because page.tsx never fetched the queue.
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
    // Task B guardrails:
    guardNaming, guardCaptions, guardAltText, guardTiers, guardRatios, guardTextPolicy, guardPalette,
    // SCOPE 2 · media-pipeline-frontend brief — Review queue + area taxonomy + library counts:
    reviewQueue, areaTaxonomy, libraryCounts,
  ] = await Promise.all([
    sb.from('mkt_v_media_by_tier').select('*'),
    sb.from('v_marketing_media_page').select('*').limit(5000),
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
    // PBS 2026-07-19 · view was rewritten 2026-07-18 (commit 1337952b): dropped
    // scope_type/scope_key and added kind/sort_order/area_key/ref_id/sort_key. Old
    // select silently returned null → CoverageTab rendered empty.
    sb.from('v_media_coverage_matrix').select('property_id, kind, sort_order, area_key, ref_id, scope_label, sort_key, primary_tier, n').eq('property_id', pid),
    sb.from('v_video_style_presets').select('*').or(`property_id.is.null,property_id.eq.${pid}`),
    sb.from('v_video_music_tracks').select('*').order('created_at', { ascending: false }).limit(100),
    // Task B guardrails
    sb.from('v_media_naming_conventions').select('*'),
    sb.from('v_media_caption_rules').select('*'),
    sb.from('v_media_alt_text_rules').select('*'),
    sb.from('v_media_tier_thresholds').select('*'),
    sb.from('v_media_aspect_ratio_rules').select('*'),
    sb.from('v_media_text_policy').select('*').eq('id', 1).maybeSingle(),
    sb.from('v_media_brand_palette').select('*'),
    // SCOPE 2 · Review queue (flagged, any status; brief ADR-149..152):
    sb.from('v_media_review_queue')
      .select('asset_id, property_id, original_filename, status, content_class, quality_index, technical_score, aesthetic_score, review_reason, category, needs_review, created_at')
      .eq('property_id', pid)
      .order('created_at', { ascending: false })
      .limit(1000),
    // SCOPE 3+4 · area taxonomy (drives Clarify dropdown + left folder rail):
    sb.from('v_media_area_taxonomy')
      .select('property_id, kind, sort_order, ref_id, area_key, name, extra, photo_count')
      .eq('property_id', pid)
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true }),
    // SCOPE 1/6 · library counts snapshot (kept for parity with API route):
    sb.from('v_media_library_counts')
      .select('property_id, pics_ready, videos_total, with_tier, with_area, to_clarify, destination, review_junk, website, ota, social, internal')
      .eq('property_id', pid)
      .maybeSingle(),
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
    guardrails: {
      naming: guardNaming.data ?? [],
      captions: guardCaptions.data ?? [],
      altText: guardAltText.data ?? [],
      tierThresholds: guardTiers.data ?? [],
      aspectRatios: guardRatios.data ?? [],
      textPolicy: guardTextPolicy.data ?? null,
      brandPalette: guardPalette.data ?? [],
    },
    reviewRows: (() => {
      // PBS 2026-07-17 hot-fix — enrich review rows with public_url / mime_type /
      // master_path from mediaPage. v_media_review_queue omits these fields, so
      // ReviewTab tiles were rendering "no preview". No backend change needed —
      // the JOIN is done here in server-space by asset_id.
      const urlByAssetId = new Map<string, { public_url: string | null; master_path: string | null; mime_type: string | null; raw_path: string | null }>();
      for (const r of ((mediaPage.data ?? []) as Array<any>)) {
        urlByAssetId.set(String(r.asset_id), {
          public_url: r.public_url ?? null,
          master_path: r.master_path ?? null,
          mime_type: r.mime_type ?? null,
          raw_path: r.raw_path ?? null,
        });
      }
      return ((reviewQueue.data ?? []) as Array<any>).map((r) => {
        const extra = urlByAssetId.get(String(r.asset_id)) ?? { public_url: null, master_path: null, mime_type: null, raw_path: null };
        return { ...r, ...extra };
      });
    })(),
    areaTaxonomy: areaTaxonomy.data ?? [],
    libraryCounts: libraryCounts.data ?? null,
    errors: [
      byTier.error, mediaPage.error, channelSpecs.error, rulesActive.error,
      aiGens.error, videoEdits.error, reality.error, categories.error,
      rooms.error, facilities.error, facilitiesRaw.error, activitiesRaw.error, transportRaw.error,
      boatsRaw.error, cruisesRaw.error, videoTemplates.error, videoBriefs.error, pillars.error,
      coverageMatrix.error, stylePresets.error, musicTracks.error,
      guardNaming.error, guardCaptions.error, guardAltText.error, guardTiers.error, guardRatios.error,
      guardTextPolicy.error, guardPalette.error,
      reviewQueue.error, areaTaxonomy.error, libraryCounts.error,
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
            reviewRows={data.reviewRows as any}
            areaTaxonomy={data.areaTaxonomy as any}
            libraryCounts={data.libraryCounts as any}
            stylePresets={data.stylePresets as any}
            musicTracks={data.musicTracks as any}
            guardrails={data.guardrails as any}
          />
        </div>
      </DashboardPage>
    </div>
  );
}