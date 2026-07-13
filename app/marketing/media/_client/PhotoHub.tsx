// app/marketing/media/_client/PhotoHub.tsx
// PBS 2026-07-13 · Task A — Photo sub-hub mirroring VideoHub's 4-tab nested strip.
// 2026-07-13 · Task B — added "Coverage" sub-tab surfacing v_media_coverage_matrix.
// PBS 2026-07-14 · Task B (media area) — passes guardrails to SettingsTab.
'use client';

import { useState } from 'react';
import LibraryTab from './LibraryTab';
import AiStudioTab from './AiStudioTab';
import ClarifyTab from './ClarifyTab';
import SettingsTab from './SettingsTab';
import CoverageTab, { type CoverageRow } from './CoverageTab';
import type { PromptCategory, RoomOption, FacilityOption, MediaTaxonomy, GuardrailsData } from './MediaHub';

type Sub = 'library' | 'ai' | 'clarify' | 'coverage' | 'settings';

interface Props {
  propertyId: number;
  byTier: any[];
  mediaPage: any[];
  channelSpecs: any[];
  rulesActive: any[];
  aiGens: any[];
  reality: any | null;
  categories: PromptCategory[];
  rooms: RoomOption[];
  facilities: FacilityOption[];
  taxonomy: MediaTaxonomy;
  areaOptions: string[];
  coverageRows?: CoverageRow[];
  initialSub?: Sub;
  initialAiAssetId?: string | null;
  guardrails: GuardrailsData;
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

export default function PhotoHub(props: Props) {
  const [sub, setSub] = useState<Sub>(props.initialSub ?? 'library');
  const [aiInitialAssetId, setAiInitialAssetId] = useState<string | null>(props.initialAiAssetId ?? null);

  const photoRows = (props.mediaPage ?? []).filter((r: any) => !isVideoRow(r));
  const clarifyCount = photoRows.filter((r: any) => r.property_area == null || r.primary_tier == null).length;

  const TABS: Array<{ key: Sub; label: string; badge?: number }> = [
    { key: 'library',  label: 'Photo Library'   },
    { key: 'ai',       label: 'Photo AI Studio' },
    { key: 'clarify',  label: 'Photo Clarify',  badge: clarifyCount },
    { key: 'coverage', label: 'Coverage'        },
    { key: 'settings', label: 'Photo Settings'  },
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
                  background: RED, color: '#FFF', fontSize: 9, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 8, letterSpacing: 0,
                }}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {sub === 'library'  && (
        <LibraryTab
          propertyId={props.propertyId}
          byTier={props.byTier}
          mediaPage={props.mediaPage}
          channelSpecs={props.channelSpecs}
          onSendToAi={handleSendToAi}
          areaOptions={props.areaOptions}
          rooms={props.rooms}
          taxonomy={props.taxonomy}
        />
      )}
      {sub === 'ai' && (
        <AiStudioTab
          propertyId={props.propertyId}
          mediaPage={props.mediaPage}
          aiGens={props.aiGens}
          initialSourceAssetId={aiInitialAssetId}
          categories={props.categories}
          rooms={props.rooms}
          facilities={props.facilities}
          taxonomy={props.taxonomy}
        />
      )}
      {sub === 'clarify' && (
        <ClarifyTab
          mediaPage={props.mediaPage}
          areaOptions={props.areaOptions}
          rooms={props.rooms}
          taxonomy={props.taxonomy}
        />
      )}
      {sub === 'coverage' && (
        <CoverageTab rows={props.coverageRows ?? []} />
      )}
      {sub === 'settings' && (
        <SettingsTab
          propertyId={props.propertyId}
          channelSpecs={props.channelSpecs}
          rulesActive={props.rulesActive}
          reality={props.reality}
          categories={props.categories}
          rooms={props.rooms}
          facilities={props.facilities}
          mediaPage={props.mediaPage}
          guardrails={props.guardrails}
        />
      )}
    </div>
  );
}
