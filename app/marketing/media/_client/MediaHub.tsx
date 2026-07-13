// app/marketing/media/_client/MediaHub.tsx
// PBS 2026-07-12 — Client tab strip for Media hub.
// 2026-07-12 pm: swap the thin VideoTab for VideoHub — the new 4-tab internal
// strip (Video Library · Video AI Studio · Video Clarify · Video Settings)
// per task #148.
// 2026-07-13 · Phase 2: pipe videoBriefs + pillars through to VideoHub for the
// new "Video Briefs" sub-tab (unified video pipeline entry point).
'use client';

import { useState } from 'react';
import LibraryTab from './LibraryTab';
import AiStudioTab from './AiStudioTab';
import VideoHub from './VideoHub';
import ClarifyTab from './ClarifyTab';
import SettingsTab from './SettingsTab';
import type { VideoBriefRow } from './VideoBriefsPanel';
import type { PillarOption } from './NewVideoBriefForm';

type TabKey = 'library' | 'ai' | 'video' | 'clarify' | 'settings';

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
  room_type_id: number;
  property_id: number;
  room_type_name: string;
  room_type_name_short: string | null;
  max_guests: number | null;
  units: number | null;
  description_clean: string | null;
  amenities: string[] | null;
  amenities_count: number | null;
}

export interface FacilityOption {
  facility_id: number;
  property_id: number;
  category: string | null;
  facility_name: string;
  facility_description: string | null;
  facility_key: string | null;
  ai_description: string | null;
  materials: string[] | null;
  view_direction: string | null;
  signature_elements: string[] | null;
  time_of_day_hint: string | null;
  active: boolean;
  sort_order: number;
  updated_by: string | null;
  updated_at: string | null;
}

export interface VideoTemplate {
  template_key: string;
  display_name: string;
  description: string | null;
  duration_sec: number;
  min_assets: number;
  max_assets: number;
  aspect: string;
}

// 2026-07-12 pm: 5-category taxonomy that mirrors the Settings sidebar
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
}

const HAIR   = '#E6DFCC';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B23A2E';

export default function MediaHub(props: Props) {
  const [tab, setTab] = useState<TabKey>('library');
  const [aiInitialAssetId, setAiInitialAssetId] = useState<string | null>(null);

  const clarifyCount = (props.mediaPage ?? []).filter((r: any) => r.property_area == null || r.primary_tier == null).length;
  const openBriefsCount = (props.videoBriefs ?? []).filter(b =>
    b.status !== 'archived' && b.status !== 'published').length;

  const TABS: Array<{ key: TabKey; label: string; badge?: number }> = [
    { key: 'library',  label: 'Library'    },
    { key: 'ai',       label: 'AI Studio'  },
    { key: 'video',    label: 'Video',     badge: openBriefsCount },
    { key: 'clarify',  label: 'Clarify',   badge: clarifyCount },
    { key: 'settings', label: 'Settings ⚙' },
  ];

  function handleSendToAi(assetId: string) {
    setAiInitialAssetId(assetId);
    setTab('ai');
  }

  return (
    <div>
      <div style={{ display:'flex', gap:4, borderBottom:'1px solid '+HAIR, marginBottom:16 }}>
        {TABS.map(t => {
          const active = tab === t.key;
          const showBadge = t.badge != null && t.badge > 0;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding:'10px 18px', fontSize:12, letterSpacing:'0.06em',
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

      {tab === 'library'  && <LibraryTab  propertyId={props.propertyId} byTier={props.byTier} mediaPage={props.mediaPage} channelSpecs={props.channelSpecs} onSendToAi={handleSendToAi} areaOptions={props.areaOptions} rooms={props.rooms} taxonomy={props.taxonomy} />}
      {tab === 'ai'       && <AiStudioTab propertyId={props.propertyId} mediaPage={props.mediaPage} aiGens={props.aiGens} initialSourceAssetId={aiInitialAssetId} categories={props.categories} rooms={props.rooms} facilities={props.facilities} taxonomy={props.taxonomy} />}
      {tab === 'video'    && <VideoHub    propertyId={props.propertyId} mediaPage={props.mediaPage} channelSpecs={props.channelSpecs} videoEdits={props.videoEdits} templates={props.videoTemplates ?? []} categories={props.categories} rooms={props.rooms} facilities={props.facilities} taxonomy={props.taxonomy} areaOptions={props.areaOptions} videoBriefs={props.videoBriefs} pillars={props.pillars} />}
      {tab === 'clarify'  && <ClarifyTab  mediaPage={props.mediaPage} areaOptions={props.areaOptions} rooms={props.rooms} taxonomy={props.taxonomy} />}
      {tab === 'settings' && <SettingsTab propertyId={props.propertyId} channelSpecs={props.channelSpecs} rulesActive={props.rulesActive} reality={props.reality} categories={props.categories} rooms={props.rooms} facilities={props.facilities} mediaPage={props.mediaPage} />}
    </div>
  );
}
