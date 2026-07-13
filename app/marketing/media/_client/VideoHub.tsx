// app/marketing/media/_client/VideoHub.tsx
// PBS 2026-07-12 · Task #148 — internal 5-tab strip for the Video area:
//   • Video Briefs — VideoBriefsPanel (Phase 2 unified pipeline entry point)
//   • Video Library — VideoLibraryTab
//   • Video AI Studio — VideoAiStudioTab (Shotstack EDL composer)
//   • Video Clarify — VideoClarifyTab
//   • Video Settings — passthrough note (image + video share same guardrails/channels)
// 2026-07-13 · Phase 2: added Video Briefs as the leftmost / default sub-tab.
'use client';

import { useState } from 'react';
import VideoBriefsPanel, { type VideoBriefRow } from './VideoBriefsPanel';
import VideoLibraryTab from './VideoLibraryTab';
import VideoAiStudioTab from './VideoAiStudioTab';
import VideoClarifyTab from './VideoClarifyTab';
import type { PillarOption } from './NewVideoBriefForm';
import type { PromptCategory, RoomOption, FacilityOption, MediaTaxonomy } from './MediaHub';

type Sub = 'briefs' | 'library' | 'ai' | 'clarify' | 'settings';

interface VideoTemplate {
  template_key: string;
  display_name: string;
  description: string | null;
  duration_sec: number;
  min_assets: number;
  max_assets: number;
  aspect: string;
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
}

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const WHITE  = '#FFFFFF';
const RED    = '#B23A2E';

function isVideoRow(r: any): boolean {
  if ((r?.asset_type ?? '').toLowerCase() === 'video') return true;
  const mt = (r?.mime_type ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  const p = (r?.public_url ?? r?.master_path ?? '').toLowerCase();
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test(p);
}

export default function VideoHub(props: Props) {
  const [sub, setSub] = useState<Sub>('briefs');
  const [aiInitialAssetId, setAiInitialAssetId] = useState<string | null>(null);

  const videoRows = (props.mediaPage ?? []).filter(isVideoRow);
  const clarifyCount = videoRows.filter((r: any) => r.property_area == null || r.primary_tier == null).length;
  const openBriefs = (props.videoBriefs ?? []).filter(b =>
    b.status !== 'archived' && b.status !== 'published').length;

  const TABS: Array<{ key: Sub; label: string; badge?: number }> = [
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
      {/* Sub-tab strip — lighter chrome, sits below the main MediaHub tabs */}
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
                  background: RED, color: '#FFF', fontSize: 9, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 8, letterSpacing: 0,
                }}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {sub === 'briefs' && (
        <VideoBriefsPanel
          propertyId={props.propertyId}
          briefs={props.videoBriefs ?? []}
          pillars={props.pillars ?? []}
        />
      )}

      {sub === 'library'  && (
        <VideoLibraryTab
          propertyId={props.propertyId}
          mediaPage={props.mediaPage}
          channelSpecs={props.channelSpecs}
          onSendToAi={handleSendToAi}
          areaOptions={props.areaOptions}
          rooms={props.rooms}
          taxonomy={props.taxonomy}
        />
      )}

      {sub === 'ai' && (
        <VideoAiStudioTab
          propertyId={props.propertyId}
          mediaPage={props.mediaPage}
          channelSpecs={props.channelSpecs}
          videoEdits={props.videoEdits}
          templates={props.templates}
          categories={props.categories}
          rooms={props.rooms}
          facilities={props.facilities}
          taxonomy={props.taxonomy}
          initialSourceAssetId={aiInitialAssetId}
        />
      )}

      {sub === 'clarify' && (
        <VideoClarifyTab
          mediaPage={props.mediaPage}
          areaOptions={props.areaOptions}
          rooms={props.rooms}
          taxonomy={props.taxonomy}
        />
      )}

      {sub === 'settings' && (
        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:20, color:INK }}>
          <div style={{ fontSize:12, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:700, marginBottom:8 }}>
            Video settings
          </div>
          <p style={{ fontSize:13, color:INK, lineHeight:1.5, marginBottom:12 }}>
            Video shares the same guardrails and channel specs as image. Manage them in the
            main <strong>Settings ⚙</strong> tab (top-level strip) under <em>Guardrails</em> and{' '}
            <em>Channels</em>. Video-specific spec columns (aspect ratio, max duration,
            audio required) are already listed there for every channel.
          </p>
          <p style={{ fontSize:12, color:INK_M, lineHeight:1.5 }}>
            Video templates (currently 3: sunset bumper 15s, program intro 30s, program montage 60s)
            live in <code>media.video_templates</code>. Add rows there to expand the AI Studio picker.
          </p>
        </div>
      )}
    </div>
  );
}
