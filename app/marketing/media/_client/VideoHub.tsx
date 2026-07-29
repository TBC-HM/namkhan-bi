// app/marketing/media/_client/VideoHub.tsx
// PBS 2026-07-13 · Video AI Studio v1 — VideoSettingsTab replaces the
// pass-through settings note. Includes style-preset + music-library editing.
// PBS 2026-07-18 · media-video-frontend brief · scopes 1/2/3/4/5 — new
// "Triage" sub-tab wired to public.v_media_videos: poster-card grid + filters
// + inline Keep/Archive/Delete + area dropdown + dormant-state banner. Existing
// Library / AI Studio / Clarify / Settings tabs untouched (additive UI rule).
// PBS 2026-07-29 · media-video-frontend brief gap round (A2/A3):
//   - Clarify sub-tab rewired to the brief contract (v_media_videos hotel-class,
//     no-area rows + v_media_area_taxonomy dropdown + fn_* RPC confirm/bulk).
//   - New "Review" sub-tab wired to public.v_media_video_review_queue
//     (Keep = fn_clear_review · Delete = fn_confirm_junk).
'use client';

import { useState } from 'react';
import VideoBriefsPanel, { type VideoBriefRow } from './VideoBriefsPanel';
import VideoLibraryTab from './VideoLibraryTab';
import VideoAiStudioTab from './VideoAiStudioTab';
import VideoClarifyTab from './VideoClarifyTab';
import VideoSettingsTab from './VideoSettingsTab';
import VideoTriageTab, { type VideoRow, type AreaTaxonomyRow } from './VideoTriageTab';
import VideoReviewTab, { type VideoReviewRow } from './VideoReviewTab';
import type { PillarOption } from './NewVideoBriefForm';
import type { PromptCategory, RoomOption, FacilityOption, MediaTaxonomy } from './MediaHub';

type Sub = 'triage' | 'review' | 'briefs' | 'library' | 'ai' | 'clarify' | 'settings';

interface VideoTemplate {
  template_key: string; display_name: string; description: string | null;
  duration_sec: number; min_assets: number; max_assets: number; aspect: string;
}
interface Props {
  propertyId: number;
  mediaPage: any[];
  channelSpecs: any[];
  videoEdits: any[];
  templates: VideoTemplate[];
  categories: PromptCategory[];
  rooms: RoomOption[];
  facilities: FacilityOption[];
  taxonomy: MediaTaxonomy;
  areaOptions: string[];
  videoBriefs?: VideoBriefRow[];
  pillars?: PillarOption[];
  stylePresets?: any[];
  musicTracks?: any[];
  // media-video-frontend brief: server-loaded from v_media_videos + v_media_area_taxonomy
  videos?: VideoRow[];
  areaTaxonomy?: AreaTaxonomyRow[];
  // A3 · server-loaded from public.v_media_video_review_queue
  videoReviewQueue?: VideoReviewRow[];
}

const HAIR   = '#E6DFCC';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B23A2E';

export default function VideoHub(props: Props) {
  // PBS 2026-07-18 · default to Triage sub-tab (the poster-grid review surface).
  const [sub, setSub] = useState<Sub>('triage');
  const [aiInitialAssetId, setAiInitialAssetId] = useState<string | null>(null);

  // A2 · clarify count now from v_media_videos: hotel-class clips with no area.
  const clarifyCount = (props.videos ?? []).filter(
    (v) => v.content_class === 'hotel' && v.room_type_id == null && v.facility_id == null && v.activity_id == null && v.destination_id == null,
  ).length;
  const openBriefs = (props.videoBriefs ?? []).filter(b => b.status !== 'archived' && b.status !== 'published').length;
  const triageCount = (props.videos ?? []).length;
  const triageFlagged = (props.videos ?? []).filter((v) => v.needs_review === true).length;
  const reviewCount = (props.videoReviewQueue ?? []).length;

  const TABS: Array<{ key: Sub; label: string; badge?: number; badgeColor?: string }> = [
    { key: 'triage',   label: 'Triage',         badge: triageFlagged || triageCount, badgeColor: triageFlagged ? RED : undefined },
    { key: 'review',   label: 'Review',         badge: reviewCount, badgeColor: RED },
    { key: 'briefs',   label: 'Video Briefs',   badge: openBriefs },
    { key: 'library',  label: 'Video Library'   },
    { key: 'ai',       label: 'Video AI Studio' },
    { key: 'clarify',  label: 'Video Clarify',  badge: clarifyCount },
    { key: 'settings', label: 'Video Settings'  },
  ];

  function handleSendToAi(assetId: string) {
    setAiInitialAssetId(assetId);
    setSub('ai');
  }

  return (
    <div>
      <div style={{ display:'flex', gap:4, borderBottom:'1px solid '+HAIR, marginBottom:16, background:'#FAF7EE', paddingLeft:6, borderTop:'1px solid '+HAIR }}>
        {TABS.map(t => {
          const active = sub === t.key;
          const showBadge = t.badge != null && t.badge > 0;
          return (
            <button key={t.key} onClick={() => setSub(t.key)} style={{
              padding:'8px 14px', fontSize:11, letterSpacing:'0.06em',
              textTransform:'uppercase', border:'none', background:'transparent',
              color: active ? FOREST : INK_M,
              borderBottom: active ? '2px solid ' + FOREST : '2px solid transparent',
              fontWeight: active ? 700 : 500, cursor:'pointer', marginBottom:-1,
              display:'inline-flex', alignItems:'center', gap:6,
            }}>
              {t.label}
              {showBadge && (
                <span style={{
                  background: (t as any).badgeColor || RED, color: '#FFF', fontSize: 9, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 8, letterSpacing: 0,
                }}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {sub === 'triage' && (
        <VideoTriageTab videos={props.videos ?? []} areaTaxonomy={props.areaTaxonomy ?? []} />
      )}
      {sub === 'review' && (
        <VideoReviewTab rows={props.videoReviewQueue ?? []} />
      )}
      {sub === 'briefs' && (
        <VideoBriefsPanel propertyId={props.propertyId} briefs={props.videoBriefs ?? []} pillars={props.pillars ?? []} />
      )}
      {sub === 'library'  && (
        <VideoLibraryTab propertyId={props.propertyId} mediaPage={props.mediaPage} channelSpecs={props.channelSpecs} onSendToAi={handleSendToAi} areaOptions={props.areaOptions} rooms={props.rooms} taxonomy={props.taxonomy} />
      )}
      {sub === 'ai' && (
        <VideoAiStudioTab propertyId={props.propertyId} mediaPage={props.mediaPage} channelSpecs={props.channelSpecs} videoEdits={props.videoEdits} templates={props.templates} categories={props.categories} rooms={props.rooms} facilities={props.facilities} taxonomy={props.taxonomy} initialSourceAssetId={aiInitialAssetId} />
      )}
      {sub === 'clarify' && (
        <VideoClarifyTab videos={props.videos ?? []} areaTaxonomy={props.areaTaxonomy ?? []} />
      )}
      {sub === 'settings' && (
        <VideoSettingsTab propertyId={props.propertyId} presets={props.stylePresets ?? []} musicTracks={props.musicTracks ?? []} />
      )}
    </div>
  );
}
