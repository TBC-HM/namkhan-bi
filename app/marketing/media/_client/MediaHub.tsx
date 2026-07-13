// app/marketing/media/_client/MediaHub.tsx
// PBS 2026-07-13 · Video AI Studio v1 — pass stylePresets + musicTracks
// through to VideoHub → VideoSettingsTab.
// PBS 2026-07-14 · Task B — thread photo guardrails through PhotoHub.
// PBS 2026-07-14 · TASK 3 — thread reviewRows through PhotoHub.
'use client';

import { useState } from 'react';
import PhotoHub from './PhotoHub';
import VideoHub from './VideoHub';
import type { VideoBriefRow } from './VideoBriefsPanel';
import type { PillarOption } from './NewVideoBriefForm';
import type { ReviewRow } from './ReviewTab';
import type {
  NamingRow, CaptionRow, AltTextRow, TierThresholdRow,
  AspectRatioRow, TextPolicyRow, BrandPaletteRow,
} from './PhotoGuardrailsPanel';

type TabKey = 'pics' | 'videos';

export interface PromptCategory {
  key: string;
  display_name: string;
  property_id: number | null;
  base_prompt: string;
  default_target_tier: string;
  example_hint: string | null;
  active: boolean;
  sort_order: number;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
  requires_context?: 'room' | 'facility' | 'none' | null;
}
export interface RoomOption {
  room_type_id: number; property_id: number; room_type_name: string;
  room_type_name_short: string | null; max_guests: number | null; units: number | null;
  description_clean: string | null; amenities: string[] | null; amenities_count: number | null;
}
export interface FacilityOption {
  facility_id: number; property_id: number; category: string | null;
  facility_name: string; facility_description: string | null;
  facility_key: string | null; ai_description: string | null;
  materials: string[] | null; view_direction: string | null;
  signature_elements: string[] | null; time_of_day_hint: string | null;
  active: boolean; sort_order: number; updated_by: string | null; updated_at: string | null;
}
export interface VideoTemplate {
  template_key: string; display_name: string; description: string | null;
  duration_sec: number; min_assets: number; max_assets: number; aspect: string;
}
export interface TaxonomyEntry { id: number; name: string }
export interface FacilityTaxonomyEntry extends TaxonomyEntry { parent_id: number | null; parent_name: string | null }
export interface ActivityTaxonomyEntry extends TaxonomyEntry { facility_id: number | null; facility_name: string | null }
export interface TransportTaxonomyEntry extends TaxonomyEntry { kind: string | null; route_from: string | null; route_to: string | null }
export interface BoatTaxonomyEntry extends TaxonomyEntry { model: string | null; capacity_pax: number | null }
export interface BoatCruiseTaxonomyEntry extends TaxonomyEntry { boat_name: string | null; kind: string | null; route_from: string | null; route_to: string | null }
export interface MediaTaxonomy {
  rooms: TaxonomyEntry[];
  facilities: FacilityTaxonomyEntry[];
  activities: ActivityTaxonomyEntry[];
  meeting_spaces: TaxonomyEntry[];
  transport: TransportTaxonomyEntry[];
  boats: BoatTaxonomyEntry[];
  boat_cruises: BoatCruiseTaxonomyEntry[];
}

export interface GuardrailsData {
  naming: NamingRow[];
  captions: CaptionRow[];
  altText: AltTextRow[];
  tierThresholds: TierThresholdRow[];
  aspectRatios: AspectRatioRow[];
  textPolicy: TextPolicyRow | null;
  brandPalette: BrandPaletteRow[];
}

interface Props {
  propertyId: number;
  byTier: any[];
  mediaPage: any[];
  channelSpecs: any[];
  rulesActive: any[];
  aiGens: any[];
  videoEdits: any[];
  reality: any | null;
  categories: PromptCategory[];
  rooms: RoomOption[];
  facilities: FacilityOption[];
  taxonomy: MediaTaxonomy;
  areaOptions: string[];
  videoTemplates?: VideoTemplate[];
  videoBriefs?: VideoBriefRow[];
  pillars?: PillarOption[];
  coverageRows?: any[];
  reviewRows?: ReviewRow[];
  stylePresets?: any[];
  musicTracks?: any[];
  guardrails?: GuardrailsData;
}

const HAIR   = '#E6DFCC';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B23A2E';

function isVideoRow(r: any): boolean {
  if ((r?.asset_type ?? '').toLowerCase() === 'video') return true;
  const mt = (r?.mime_type ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  const p = (r?.public_url ?? r?.master_path ?? '').toLowerCase();
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test(p);
}

const EMPTY_GUARDRAILS: GuardrailsData = {
  naming: [], captions: [], altText: [], tierThresholds: [],
  aspectRatios: [], textPolicy: null, brandPalette: [],
};

export default function MediaHub(props: Props) {
  const [tab, setTab] = useState<TabKey>('pics');

  const videoRows = (props.mediaPage ?? []).filter(isVideoRow);
  const picsCount = (props.mediaPage ?? []).length - videoRows.length;
  const vidsCount = videoRows.length;
  const openBriefsCount = (props.videoBriefs ?? []).filter(b => b.status !== 'archived' && b.status !== 'published').length;

  const TABS: Array<{ key: TabKey; label: string; badge?: number; count?: number }> = [
    { key: 'pics',   label: 'Pics',   count: picsCount },
    { key: 'videos', label: 'Videos', count: vidsCount, badge: openBriefsCount },
  ];

  return (
    <div>
      <div style={{ display:'flex', gap:4, borderBottom:'1px solid '+HAIR, marginBottom:16 }}>
        {TABS.map(t => {
          const active = tab === t.key;
          const showBadge = t.badge != null && t.badge > 0;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding:'10px 22px', fontSize:12, letterSpacing:'0.06em',
              textTransform:'uppercase', border:'none', background:'transparent',
              color: active ? FOREST : INK_M,
              borderBottom: active ? '2px solid ' + FOREST : '2px solid transparent',
              fontWeight: active ? 700 : 500, cursor:'pointer', marginBottom:-1,
              display:'inline-flex', alignItems:'center', gap:8,
            }}>
              <span>{t.label}</span>
              {t.count != null && (
                <span style={{ fontSize:10, color: active ? FOREST : INK_M, opacity:0.7 }}>· {t.count.toLocaleString()}</span>
              )}
              {showBadge && (
                <span style={{ background: RED, color: '#FFF', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, letterSpacing: 0 }}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'pics' && (
        <PhotoHub
          propertyId={props.propertyId}
          byTier={props.byTier}
          mediaPage={props.mediaPage}
          channelSpecs={props.channelSpecs}
          rulesActive={props.rulesActive}
          aiGens={props.aiGens}
          reality={props.reality}
          categories={props.categories}
          rooms={props.rooms}
          facilities={props.facilities}
          taxonomy={props.taxonomy}
          areaOptions={props.areaOptions}
          coverageRows={props.coverageRows as any}
          reviewRows={props.reviewRows}
          guardrails={props.guardrails ?? EMPTY_GUARDRAILS}
        />
      )}
      {tab === 'videos' && (
        <VideoHub
          propertyId={props.propertyId}
          mediaPage={props.mediaPage}
          channelSpecs={props.channelSpecs}
          videoEdits={props.videoEdits}
          templates={props.videoTemplates ?? []}
          categories={props.categories}
          rooms={props.rooms}
          facilities={props.facilities}
          taxonomy={props.taxonomy}
          areaOptions={props.areaOptions}
          videoBriefs={props.videoBriefs}
          pillars={props.pillars}
          stylePresets={props.stylePresets ?? []}
          musicTracks={props.musicTracks ?? []}
        />
      )}
    </div>
  );
}
