// app/marketing/media/_client/MediaHub.tsx
// PBS 2026-07-12 — Client tab strip for Media hub.
// PBS 2026-07-11 pm: added Library→AI Studio jump. Clicking "Send to AI" on
// any Library row switches to AI Studio and preselects that asset.
// 2026-07-11 pm (later): pipes `categories` (v_ai_prompt_categories) into
// both AiStudioTab (dropdown source) and SettingsTab (Prompt Categories sub-tab).
// 2026-07-12: added `clarify` tab (4th, before Settings) — grid of assets
// missing property_area or primary_tier; click a thumb → AssetEditDrawer.
'use client';

import { useState } from 'react';
import LibraryTab from './LibraryTab';
import AiStudioTab from './AiStudioTab';
import VideoTab from './VideoTab';
import ClarifyTab from './ClarifyTab';
import SettingsTab from './SettingsTab';

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
  areaOptions: string[];
}

const HAIR   = '#E6DFCC';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B23A2E';

export default function MediaHub(props: Props) {
  const [tab, setTab] = useState<TabKey>('library');
  const [aiInitialAssetId, setAiInitialAssetId] = useState<string | null>(null);

  const clarifyCount = (props.mediaPage ?? []).filter((r: any) => r.property_area == null || r.primary_tier == null).length;

  const TABS: Array<{ key: TabKey; label: string; badge?: number }> = [
    { key: 'library',  label: 'Library'    },
    { key: 'ai',       label: 'AI Studio'  },
    { key: 'video',    label: 'Video'      },
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

      {tab === 'library'  && <LibraryTab  propertyId={props.propertyId} byTier={props.byTier} mediaPage={props.mediaPage} channelSpecs={props.channelSpecs} onSendToAi={handleSendToAi} areaOptions={props.areaOptions} />}
      {tab === 'ai'       && <AiStudioTab propertyId={props.propertyId} mediaPage={props.mediaPage} aiGens={props.aiGens} initialSourceAssetId={aiInitialAssetId} categories={props.categories} />}
      {tab === 'video'    && <VideoTab    propertyId={props.propertyId} mediaPage={props.mediaPage} channelSpecs={props.channelSpecs} videoEdits={props.videoEdits} />}
      {tab === 'clarify'  && <ClarifyTab  mediaPage={props.mediaPage} areaOptions={props.areaOptions} />}
      {tab === 'settings' && <SettingsTab propertyId={props.propertyId} channelSpecs={props.channelSpecs} rulesActive={props.rulesActive} reality={props.reality} categories={props.categories} />}
    </div>
  );
}
