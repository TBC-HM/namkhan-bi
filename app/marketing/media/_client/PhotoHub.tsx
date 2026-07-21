// app/marketing/media/_client/PhotoHub.tsx
// PBS 2026-07-13 · Task A — Photo sub-hub mirroring VideoHub's 4-tab nested strip.
// 2026-07-13 · Task B — added "Coverage" sub-tab surfacing v_media_coverage_matrix.
// PBS 2026-07-14 · Task B (media area) — passes guardrails to SettingsTab.
// PBS 2026-07-14 · TASK 3 — new "Review" sub-tab powered by v_media_review_queue.
// PBS 2026-07-14 · Coverage drill-down — pass mediaPage to CoverageTab so cells
//   open a filtered thumbnail modal. Data source unchanged; page.tsx already
//   fetches with dynamic='force-dynamic' + revalidate=0.
// PBS 2026-07-17 · media-pipeline-frontend brief · SCOPE 3/4/5/6 — threads
//   areaTaxonomy (Clarify dropdown + folder rail) + libraryCounts (tile source
//   of truth) + destination-folder aware badges.
// PBS 2026-07-21 · MERGE Review INTO Clarify — Review tab REMOVED from the
//   PhotoHub sub-strip. Clarify now hosts the [All · Non-Hotel · Low Quality
//   · Junk] filter chips internally and receives reviewRows as a prop. The
//   ReviewTab.tsx file itself is kept in place (reasonKind logic + as escape
//   hatch for future direct references). See ClarifyTab.tsx header for merge
//   rationale.
'use client';

import { useState } from 'react';
import LibraryTab from './LibraryTab';
import AiStudioTab from './AiStudioTab';
import ClarifyTab from './ClarifyTab';
import SettingsTab from './SettingsTab';
import CoverageTab, { type CoverageRow } from './CoverageTab';
// PBS 2026-07-21 · Review tab removed from PhotoHub — kept import of the type
// so page.tsx still passes reviewRows into props typed correctly. ReviewTab
// component itself no longer rendered here.
import { type ReviewRow } from './ReviewTab';
import ProfilesTab from './ProfilesTab';
// PBS 2026-07-21 · Archive is now a PhotoHub sub-tab (was Library headline tile)
import ArchiveTab from './ArchiveTab';
import type { PromptCategory, RoomOption, FacilityOption, MediaTaxonomy, GuardrailsData, AreaTaxonomyRow, LibraryCountsRow } from './MediaHub';

// PBS 2026-07-21 · 'review' removed from Sub union — was the standalone Review tab key.
type Sub = 'library' | 'ai' | 'clarify' | 'coverage' | 'profiles' | 'archive' | 'settings';

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
  reviewRows?: ReviewRow[];
  areaTaxonomy?: AreaTaxonomyRow[];
  libraryCounts?: LibraryCountsRow | null;
  initialSub?: Sub;
  initialAiAssetId?: string | null;
  guardrails: GuardrailsData;
}

const HAIR   = '#E6DFCC';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B23A2E';
// PBS 2026-07-21 · AMBER no longer used after Review tab removal — kept as
// commented reference for future badge work.
// const AMBER  = '#B87F26';

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
  // PBS 2026-07-20 · Photo Clarify sub-menu badge now reads the SAME single source
  // as the Library tile + Clarify tab tile: v_media_library_counts.to_clarify
  // (= needs_review IS TRUE). Old formula counted from the paged mediaPage window
  // using a different rule (property_area or primary_tier null) → 3 places showed
  // 3 different numbers for the same "to clarify" concept.
  const clarifyCount = (props as any).libraryCounts?.to_clarify
    ?? photoRows.filter((r: any) => r.property_area == null || r.primary_tier == null).length;
  // PBS 2026-07-21 · reviewCount retained for potential future consumers, but
  // no longer surfaces in the sub-strip (Review tab merged into Clarify).
  const _reviewCount = (props.reviewRows ?? []).length;
  // PBS 2026-07-21 · Archive sub-tab badge. Primary source =
  // v_media_library_counts.archive (added to LibraryCountsRow same day).
  // Falls back to byTier tier_archive row if the counts prop hasn't loaded yet.
  const archiveCount = props.libraryCounts?.archive
    ?? Number((props.byTier ?? []).find((r: any) => r.primary_tier === 'tier_archive')?.total ?? 0);

  // PBS 2026-07-21 · Review tab entry removed. Clarify badge = 383 (unified
  // v_media_library_counts.to_clarify) already reflects needs_review count.
  const TABS: Array<{ key: Sub; label: string; badge?: number; badgeColor?: string }> = [
    { key: 'library',  label: 'Photo Library'   },
    { key: 'ai',       label: 'Photo AI Studio' },
    { key: 'clarify',  label: 'Photo Clarify',  badge: clarifyCount, badgeColor: RED },
    { key: 'coverage', label: 'Coverage'        },
    { key: 'profiles', label: 'Profiles'         },
    { key: 'archive',  label: 'Archive',        badge: archiveCount },  // PBS 2026-07-21 · new sub-tab (between Profiles + Photo Settings)
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
                  background: t.badgeColor || RED, color: '#FFF', fontSize: 9, fontWeight: 700,
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
          areaTaxonomy={props.areaTaxonomy}
          libraryCounts={props.libraryCounts ?? null}
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
          areaTaxonomy={props.areaTaxonomy}
          libraryCounts={props.libraryCounts ?? null}
          reviewRows={(props.reviewRows ?? []) as any}
        />
      )}
      {sub === 'coverage' && (
        <CoverageTab
          rows={props.coverageRows ?? []}
          mediaPage={props.mediaPage ?? []}
          areaTaxonomy={props.areaTaxonomy}
        />
      )}
      {sub === 'profiles' && (
        <ProfilesTab propertyId={props.propertyId} totalRooms={props.rooms.length || 10} />
      )}
      {sub === 'archive' && (
        <ArchiveTab
          propertyId={props.propertyId}
          byTier={props.byTier}
          mediaPage={props.mediaPage}
          channelSpecs={props.channelSpecs}
          onSendToAi={handleSendToAi}
          areaOptions={props.areaOptions}
          rooms={props.rooms}
          taxonomy={props.taxonomy}
          areaTaxonomy={props.areaTaxonomy}
          libraryCounts={props.libraryCounts ?? null}
        />
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