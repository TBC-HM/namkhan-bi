// app/marketing/media/_client/ClarifyTab.tsx
// PBS 2026-07-12 — Clarify tab.
// 2026-07-13 · Coordinator scope-add — PICS clarify skips videos.
// 2026-07-13 pm · MEDIA QA v1 — tile now shows bottom-right quality badge.
// 2026-07-14 · MEDIA QA v2 — tile now displays seo_target_filename (Iris SEO)
//   with original_filename kept as a hover tooltip.
// PBS 2026-07-17 · media-pipeline-frontend brief · SCOPE 3 — inline area
//   dropdown per tile fed by v_media_area_taxonomy; one-click confirm →
//   /api/marketing/media/clarify-assign (fn_assign_area / fn_place_destination).
//   Header banner: "Iris suggests · Lens confirms". AssetEditDrawer stays as
//   the deep-edit fallback (click filename).
// PBS 2026-07-21 · MERGE Review INTO Clarify — kill standalone Review tab.
//   Add sub-strip [All · Non-Hotel · Low Quality · Junk] mirroring ReviewTab
//   categorization (reasonKind fn duplicated to avoid coupling). Data source
//   broadened to union of (area/tier null) OR (needs_review=true) via
//   reviewRows prop. Per-row Edit button opens AssetEditDrawer (mirrors
//   LibraryTab pattern). Per-row Keep/Archive/Delete actions (from ReviewTab).
//   Keep button DISABLED until property_area + primary_tier set — prevents
//   the "photo disappeared" burn when clearing review before classification.
'use client';

import { useMemo, useState } from 'react';
import AssetEditDrawer, { type AssetEditRow, type DrawerTaxonomy } from './AssetEditDrawer';
import VideoPlayerModal, { type VideoPlayerAsset } from './VideoPlayerModal';
import { qaBadge } from '@/lib/mediaQa';

interface MediaRow {
  asset_id: string;
  original_filename: string | null;
  seo_target_filename?: string | null;
  primary_tier: string | null;
  property_area: string | null;
  public_url: string | null;
  master_path: string | null;
  mime_type: string | null;
  status: string | null;
  width_px: number | null;
  height_px: number | null;
  file_size_bytes: number | string | null;
  file_size_human: string | null;
  created_at: string | null;
  quality_index?: number | null;
  technical_score?: number | null;
  aesthetic_score?: number | null;
  marketing_score?: number | null;
  qa_notes?: any;
  qa_scored_at?: string | null;
  // PBS 2026-07-21 · Review-into-Clarify merge — fields needed for reasonKind
  // filter chips + Keep gating.
  content_class?: string | null;
  review_reason?: string | null;
  needs_review?: boolean | null;
  is_hotel_property?: boolean | null;
  category?: string | null;
  sub_category?: string | null;
}

// PBS 2026-07-21 · Review-into-Clarify merge — separate shape for the
// v_media_review_queue rows arriving via reviewRows prop. Enriched server-side
// with public_url/mime_type/master_path so tiles can render.
export interface ClarifyReviewRow {
  asset_id: string;
  original_filename: string | null;
  primary_tier?: string | null;
  property_area?: string | null;
  file_size_bytes?: number | string | null;
  technical_score: number | null;
  aesthetic_score: number | null;
  marketing_score?: number | null;
  quality_index: number | null;
  is_hotel_property?: boolean | null;
  category: string | null;
  sub_category?: string | null;
  review_reason: string | null;
  qa_notes?: any;
  qa_scored_at?: string | null;
  created_at: string | null;
  raw_path?: string | null;
  master_path?: string | null;
  mime_type?: string | null;
  public_url?: string | null;
  status?: string | null;
  content_class?: string | null;
  needs_review?: boolean | null;
  property_id?: number | null;
}

// PBS 2026-07-21 · duplicated from ReviewTab so filter logic lives locally
// (avoids cross-file coupling). Same rule set: content_class='junk' → junk,
// review_reason contains 'hotel' → non_hotel, contains 'low quality'/'quality'
// → low_quality, else 'other'.
type FilterKey = 'all' | 'non_hotel' | 'low_quality' | 'junk';

function reasonKind(row: { content_class?: string | null; review_reason?: string | null; quality_index?: number | null }): 'non_hotel' | 'low_quality' | 'junk' | 'other' {
  // PBS 2026-07-21 · Junk = ONLY quality_index < 25 (was content_class='junk').
  // Iris's semantic "not our hotel" label lives on review_reason ('non-hotel') now.
  const q = Number(row.quality_index ?? 0);
  if (q > 0 && q < 25) return 'junk';
  const r = (row.review_reason ?? '').toLowerCase();
  if (r.includes('hotel')) return 'non_hotel';
  if (r.includes('low quality') || r.includes('low-quality') || r.includes('quality')) return 'low_quality';
  return 'other';
}

// PBS 2026-07-14 · display swap — prefer Iris SEO filename, keep original as tooltip.
function displayName(r: MediaRow): string {
  const seo = (r.seo_target_filename ?? '').trim();
  if (seo) return seo;
  const orig = (r.original_filename ?? '').trim();
  if (orig) return orig;
  return r.asset_id.slice(0, 8);
}

export interface ClarifyAreaTaxonomyRow {
  property_id: number;
  kind: string;
  sort_order: number;
  ref_id: string | null;
  area_key: string;
  name: string;
  extra: string | null;
  photo_count: number | null;
}

interface Props {
  mediaPage: MediaRow[];
  areaOptions: string[];
  rooms?: Array<{ room_type_id: number; room_type_name: string }>;
  taxonomy?: DrawerTaxonomy;
  areaTaxonomy?: ClarifyAreaTaxonomyRow[];
  // PBS 2026-07-17 · aligns the "To clarify" tile with the Library top strip.
  // When provided, uses libCounts.to_clarify + with_area etc as the single
  // source (v_media_library_counts) instead of the client-side mediaPage recompute.
  libraryCounts?: {
    pics_ready: number; with_area: number; with_tier: number;
    to_clarify: number; destination: number;
  } | null;
  // PBS 2026-07-21 · Review-into-Clarify merge — pass reviewRows so the
  // sub-strip filters (Non-Hotel/Low Quality/Junk) have actual review-queue
  // rows to categorize. These are unioned with the unclassified mediaPage rows.
  reviewRows?: ClarifyReviewRow[];
}

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const RED    = '#B23A2E';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';

const KIND_LABEL: Record<string, string> = {
  rooms: 'Accommodation',
  facilities: 'Facilities',
  jungle_spa: 'Jungle Spa',
  fnb: 'F&B',
  activities: 'Activities',
  retreats: 'Retreats',
  transport: 'Transport',
  imekong: 'Imekong',
  certifications: 'Certifications',
  team: 'Team',
  destination: 'Destination',
  other: 'Other',
  uncategorized: 'Uncategorized',
};
const KIND_ORDER = ['rooms','facilities','jungle_spa','fnb','activities','retreats','transport','imekong','certifications','destination','other','uncategorized'];

function isVideoRow(r: MediaRow): boolean {
  const mt = (r.mime_type ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  const p = (r.public_url ?? r.master_path ?? '').toLowerCase();
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test(p);
}

export default function ClarifyTab({ mediaPage, areaOptions, rooms = [], taxonomy, areaTaxonomy = [], libraryCounts = null, reviewRows = [] }: Props) {
  const [editing, setEditing] = useState<MediaRow | null>(null);
  const [playing, setPlaying] = useState<MediaRow | null>(null);
  const [localDismiss, setLocalDismiss] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // PBS 2026-07-21 · Review-into-Clarify merge — internal sub-strip filter.
  const [filter, setFilter] = useState<FilterKey>('all');

  const photos = useMemo(() => mediaPage.filter(r => !isVideoRow(r)), [mediaPage]);

  // PBS 2026-07-21 · union mediaPage photos with reviewRows on asset_id,
  // preferring reviewRows-only fields (content_class/review_reason/needs_review)
  // for the categorization chips. mediaPage rows may already carry those
  // fields (if page.tsx selects them) — reviewRows serve as the primary source
  // for any needs_review=true photo not appearing in the paged mediaPage window.
  const unified = useMemo<MediaRow[]>(() => {
    const byId = new Map<string, MediaRow>();
    for (const r of photos) byId.set(r.asset_id, r);
    for (const rr of reviewRows) {
      const existing = byId.get(rr.asset_id);
      if (existing) {
        // Merge review-only fields onto the mediaPage row
        byId.set(rr.asset_id, {
          ...existing,
          content_class:     rr.content_class     ?? existing.content_class     ?? null,
          review_reason:     rr.review_reason     ?? existing.review_reason     ?? null,
          needs_review:      rr.needs_review      ?? existing.needs_review      ?? null,
          is_hotel_property: rr.is_hotel_property ?? existing.is_hotel_property ?? null,
          category:          rr.category          ?? existing.category          ?? null,
          sub_category:      rr.sub_category      ?? existing.sub_category      ?? null,
          quality_index:     existing.quality_index ?? rr.quality_index         ?? null,
          technical_score:   existing.technical_score ?? rr.technical_score     ?? null,
          aesthetic_score:   existing.aesthetic_score ?? rr.aesthetic_score     ?? null,
          marketing_score:   existing.marketing_score ?? rr.marketing_score     ?? null,
        });
      } else {
        // reviewRow-only entry — synthesize a MediaRow shape
        byId.set(rr.asset_id, {
          asset_id: rr.asset_id,
          original_filename: rr.original_filename,
          seo_target_filename: null,
          primary_tier: rr.primary_tier ?? null,
          property_area: rr.property_area ?? null,
          public_url: rr.public_url ?? null,
          master_path: rr.master_path ?? null,
          mime_type: rr.mime_type ?? null,
          status: rr.status ?? null,
          width_px: null,
          height_px: null,
          file_size_bytes: rr.file_size_bytes ?? null,
          file_size_human: null,
          created_at: rr.created_at,
          quality_index: rr.quality_index,
          technical_score: rr.technical_score,
          aesthetic_score: rr.aesthetic_score,
          marketing_score: rr.marketing_score ?? null,
          qa_notes: rr.qa_notes,
          qa_scored_at: rr.qa_scored_at ?? null,
          content_class: rr.content_class ?? null,
          review_reason: rr.review_reason ?? null,
          needs_review: rr.needs_review ?? null,
          is_hotel_property: rr.is_hotel_property ?? null,
          category: rr.category ?? null,
          sub_category: rr.sub_category ?? null,
        });
      }
    }
    return Array.from(byId.values());
  }, [photos, reviewRows]);

  // SCOPE 3 — dropdown option groups from v_media_area_taxonomy.
  const taxonomyGroups = useMemo(() => {
    const groups: Array<{ kind: string; label: string; rows: ClarifyAreaTaxonomyRow[] }> = [];
    const byKind = new Map<string, ClarifyAreaTaxonomyRow[]>();
    for (const r of areaTaxonomy) {
      const k = r.kind;
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k)!.push(r);
    }
    for (const k of KIND_ORDER) {
      const rows = byKind.get(k);
      if (rows && rows.length) groups.push({ kind: k, label: KIND_LABEL[k] ?? k, rows });
    }
    return groups;
  }, [areaTaxonomy]);

  // PBS 2026-07-18 · bulk-select + mass-assign
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggleId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  async function bulkAssign(tr: ClarifyAreaTaxonomyRow) {
    const ids = Array.from(selectedIds); if (ids.length === 0) return;
    setBulkBusy(true); setMsg(null);
    try {
      const results = await Promise.all(ids.map(async id => {
        const res = await fetch('/api/marketing/media/clarify-assign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset_id: id, kind: tr.kind,
            ref_id: tr.kind === 'destination' ? (tr.ref_id ?? tr.area_key) : (tr.ref_id ?? null),
            area_key: tr.area_key,
          }),
        });
        const j = await res.json().catch(() => ({}));
        return { id, ok: res.ok && j?.ok };
      }));
      const okIds = results.filter(r => r.ok).map(r => r.id);
      const failed = results.length - okIds.length;
      setLocalDismiss(s => { const n = new Set(s); okIds.forEach(id => n.add(id)); return n; });
      setSelectedIds(new Set());
      setMsg(`Assigned ${okIds.length} → ${tr.name}${failed > 0 ? ' · ' + failed + ' failed' : ''}`);
    } catch (e: any) { setMsg('Bulk assign failed: ' + e.message); }
    finally { setBulkBusy(false); }
  }

  // PBS 2026-07-21 · Review-into-Clarify merge — ported from ReviewTab.
  async function clearFlag(assetId: string) {
    setBusyId(assetId); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/clear-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'clear_failed');
      setLocalDismiss((s) => { const next = new Set(s); next.add(assetId); return next; });
      setMsg('Review flag cleared — refresh to sync');
    } catch (e: any) {
      setMsg('Clear failed: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmJunk(assetId: string, filename: string | null) {
    if (!window.confirm('Confirm as junk: "' + (filename ?? assetId.slice(0, 8)) + '"? (reversible soft-delete via fn_confirm_junk)')) return;
    setBusyId(assetId); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/confirm-junk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'junk_failed');
      setLocalDismiss((s) => { const next = new Set(s); next.add(assetId); return next; });
      setMsg('Confirmed junk — refresh to sync');
    } catch (e: any) {
      setMsg('Junk-confirm failed: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function archiveAsset(assetId: string) {
    setBusyId(assetId); setMsg(null);
    try {
      const [tierRes, clearRes] = await Promise.all([
        fetch('/api/marketing/media/asset-update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_id: assetId, primary_tier: 'tier_archive' }),
        }),
        fetch('/api/marketing/media/clear-review', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_id: assetId }),
        }),
      ]);
      if (!tierRes.ok)  throw new Error('tier_set_failed');
      if (!clearRes.ok) throw new Error('clear_review_failed');
      setLocalDismiss((s) => { const next = new Set(s); next.add(assetId); return next; });
      setMsg('Archived — moved to Archive tier');
    } catch (e: any) {
      setMsg('Archive failed: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function inlineAssign(row: MediaRow, taxRow: ClarifyAreaTaxonomyRow) {
    setBusyId(row.asset_id); setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        asset_id: row.asset_id,
        kind: taxRow.kind,
        ref_id: taxRow.kind === 'destination'
          ? (taxRow.ref_id ?? taxRow.area_key)
          : (taxRow.ref_id ?? null),
        area_key: taxRow.area_key,
      };
      const res = await fetch('/api/marketing/media/clarify-assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'assign_failed');
      setLocalDismiss(s => new Set(s).add(row.asset_id));
      setMsg('Assigned ' + taxRow.name + ' — row cleared');
    } catch (e: any) {
      setMsg('Assign failed: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  // PBS 2026-07-21 · Review-into-Clarify merge — the display pool is now the
  // UNION of (unclassified: area null OR tier null) OR (flagged: needs_review).
  // Junk rows (content_class='junk') are also included so the Junk chip has
  // rows to show even if the photo already has area+tier assigned.
  const clarifyBase = useMemo(() => {
    return unified.filter(r => {
      if (localDismiss.has(r.asset_id)) return false;
      const unclassified = r.property_area == null || r.primary_tier == null;
      const flagged      = r.needs_review === true;
      // PBS 2026-07-21 · Junk = quality < 25 ONLY (never content_class).
      const q = Number(r.quality_index ?? 0);
      const isJunk       = q > 0 && q < 25;
      return unclassified || flagged || isJunk;
    });
  }, [unified, localDismiss]);

  // Filter chip counts (before filter applied so counts stay stable)
  const filterCounts = useMemo(() => {
    const nonHotel = clarifyBase.filter(r => reasonKind(r) === 'non_hotel').length;
    const lowQual  = clarifyBase.filter(r => reasonKind(r) === 'low_quality').length;
    const junk     = clarifyBase.filter(r => reasonKind(r) === 'junk').length;
    return { all: clarifyBase.length, non_hotel: nonHotel, low_quality: lowQual, junk };
  }, [clarifyBase]);

  const clarify = useMemo(() => {
    if (filter === 'all') return clarifyBase;
    return clarifyBase.filter(r => reasonKind(r) === filter);
  }, [clarifyBase, filter]);

  const stats = useMemo(() => {
    // PBS 2026-07-17 · align "To clarify" tile with the Library top strip.
    // When libraryCounts is available, use v_media_library_counts as the single
    // source of truth (hotel-class-no-area = the actual Iris-clarify backlog).
    // Otherwise fall back to the local mediaPage recompute.
    if (libraryCounts) {
      return {
        toClarify: libraryCounts.to_clarify,
        withArea:  libraryCounts.with_area,
        withTier:  libraryCounts.with_tier,
        clean:     libraryCounts.with_area,
        total:     libraryCounts.pics_ready,
      };
    }
    const total = photos.length;
    const withArea = photos.filter(r => r.property_area != null).length;
    const withTier = photos.filter(r => r.primary_tier != null).length;
    const clean = photos.filter(r => r.property_area != null && r.primary_tier != null).length;
    return { toClarify: clarify.length, withArea, withTier, clean, total };
  }, [photos, clarify.length]);

  return (
    <div>
      {/* SCOPE 3 · Iris/Lens header banner */}
      <div style={{
        background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4,
        padding: '8px 12px', marginBottom: 12, fontSize: 12, color: INK,
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <strong style={{ color: FOREST }}>Iris</strong>
        <span style={{ color: INK_M }}>suggests</span>
        <span style={{ color: INK_M }}>·</span>
        <strong style={{ color: FOREST }}>Lens</strong>
        <span style={{ color: INK_M }}>confirms</span>
        <span style={{ color: INK_M, marginLeft: 'auto', fontSize: 11 }}>
          {taxonomyGroups.length > 0
            ? 'pick an area from the dropdown to file this photo in one click'
            : 'loading area taxonomy…'}
        </span>
      </div>

      {/* PBS 2026-07-21 · Review-into-Clarify merge — canonical SubTabStrip
          typography (padding 4px 8px, fontSize 12, gap 8, borderBottom 2px
          active/transparent, background transparent, fontFamily inherit). */}
      <nav
        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2, marginBottom: 12, borderBottom: '1px solid ' + HAIR, paddingBottom: 4 }}
        role="tablist"
        aria-label="Clarify filter"
      >
        {(['all','non_hotel','low_quality','junk'] as const).map(k => {
          const on = filter === k;
          const label = k === 'all' ? 'All' : k === 'non_hotel' ? 'Non-Hotel Content' : k === 'low_quality' ? 'Low Quality' : 'Junk';
          const count = filterCounts[k];
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              role="tab"
              aria-selected={on}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 8px',
                fontSize: 12,
                fontWeight: on ? 600 : 500,
                color: on ? 'var(--ink, #1B1B1B)' : 'var(--ink-soft, #5A5A5A)',
                cursor: 'pointer',
                borderBottom: on ? '2px solid var(--primary, #1F3A2E)' : '2px solid transparent',
                textDecoration: 'none',
                fontFamily: 'inherit',
              }}
            >
              {label} · {count}
            </button>
          );
        })}
      </nav>

      {msg && (
        <div style={{ padding:'6px 10px', background:'#F7F0E1', border:'1px solid '+HAIR, borderRadius:4, marginBottom:10, fontSize:12, color:INK }}>
          {msg}
          <button onClick={() => setMsg(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: INK_M }}>x</button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8, marginBottom:16 }}>
        {[
          { label: 'To clarify', value: stats.toClarify, tone: stats.toClarify > 0 ? RED : INK },
          { label: 'With area',  value: stats.withArea },
          { label: 'With tier',  value: stats.withTier },
          { label: 'Clean',      value: stats.clean },
        ].map((t, i) => (
          <div key={i} style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:'12px 14px' }}>
            <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, marginBottom:4 }}>{t.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color: t.tone ?? INK }}>{t.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* PBS 2026-07-18 · bulk-select action bar */}
      {clarify.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, padding: '8px 10px', background: selectedIds.size > 0 ? CREAM : WHITE, border: '1px solid ' + HAIR, borderRadius: 4 }}>
          <span style={{ fontSize: 12, color: INK, fontWeight: selectedIds.size > 0 ? 600 : 400 }}>
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Bulk assign — check tiles to select'}
          </span>
          {selectedIds.size === 0 ? (
            <button onClick={() => setSelectedIds(new Set(clarify.map(r => r.asset_id)))} style={{ padding: '3px 10px', fontSize: 11, background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer' }}>
              Select all ({clarify.length})
            </button>
          ) : (
            <>
              <button onClick={() => setSelectedIds(new Set())} style={{ padding: '3px 10px', fontSize: 11, background: WHITE, color: INK_M, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer' }}>
                Clear
              </button>
              <select
                disabled={bulkBusy}
                defaultValue=""
                onChange={(e) => {
                  const [kind, key] = e.target.value.split('::');
                  if (!kind) return;
                  const tr = areaTaxonomy.find(t => t.kind === kind && t.area_key === key);
                  if (tr) bulkAssign(tr);
                  e.currentTarget.value = '';
                }}
                style={{ padding: '4px 8px', fontSize: 11, border: '1px solid ' + HAIR, background: WHITE, color: INK, borderRadius: 3, cursor: bulkBusy ? 'wait' : 'pointer', minWidth: 220 }}
              >
                <option value="">{bulkBusy ? 'Assigning…' : `⇓ Mass-assign ${selectedIds.size} to…`}</option>
                {taxonomyGroups.map(g => (
                  <optgroup key={g.kind} label={g.label}>
                    {g.rows.map(tr => (
                      <option key={g.kind + '::' + tr.area_key} value={g.kind + '::' + tr.area_key}>
                        {tr.name}{tr.photo_count != null ? ' · ' + tr.photo_count : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {clarify.length === 0 ? (
        <div style={{ padding:40, textAlign:'center', color:INK_M, background:WHITE, border:'1px solid '+HAIR, borderRadius:4 }}>
          {filter === 'all'
            ? 'Nothing to clarify — every photo has an area, a tier, and no review flag. Videos live in the Videos → Clarify tab.'
            : `No photos match the ${filter === 'non_hotel' ? 'Non-Hotel Content' : filter === 'low_quality' ? 'Low Quality' : 'Junk'} filter — try another chip above.`}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12 }}>
          {clarify.map(r => {
            const badges: Array<{ k: string; label: string; bg?: string; fg?: string }> = [];
            if (!r.property_area) badges.push({ k: 'area', label: '?area' });
            if (!r.primary_tier)  badges.push({ k: 'tier', label: '?tier' });
            // PBS 2026-07-21 · Review-into-Clarify merge — add reason-kind badge
            // matching ReviewTab colour law (junk/non-hotel = red, low-quality
            // = amber, other = cream).
            const rk = reasonKind(r);
            if (rk === 'junk')        badges.push({ k: 'junk',      label: 'Junk',              bg: '#FBE8E4', fg: RED });
            else if (rk === 'non_hotel')   badges.push({ k: 'nonhotel', label: 'Non-Hotel',         bg: '#FBE8E4', fg: RED });
            else if (rk === 'low_quality') badges.push({ k: 'lowqual',  label: 'Low quality (<30)', bg: '#FBEFD9', fg: '#B87F26' });
            else if (r.needs_review === true && r.review_reason) badges.push({ k: 'flag', label: r.review_reason, bg: CREAM, fg: INK_M });
            const qBadge = qaBadge(r.quality_index ?? null);
            const isSelected = selectedIds.has(r.asset_id);
            // PBS 2026-07-21 · Keep gating — clearing needs_review on a photo
            // without area+tier makes it "disappear" from Library too
            // (untagged filter). Force user to Edit → assign area + tier first.
            const canKeep = !!r.property_area && !!r.primary_tier;
            return (
              <div key={r.asset_id} style={{
                background: WHITE, border: '2px solid ' + (isSelected ? FOREST : HAIR), borderRadius: 4, overflow: 'hidden',
                display: 'flex', flexDirection: 'column', padding: 0, textAlign: 'left',
                position: 'relative',
              }}>
                {/* PBS 2026-07-18 · bulk-select checkbox top-right */}
                <label style={{ position: 'absolute', top: 4, right: 4, zIndex: 3, background: 'rgba(255,255,255,0.92)', borderRadius: 3, padding: '2px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleId(r.asset_id)} style={{ cursor: 'pointer', margin: 0 }} title="Select for bulk assign" />
                </label>
                {/* PBS 2026-07-17 · tile no longer a <button> so the inline
                    <select> below works. Image area is the click target for edit. */}
                <div
                  onClick={() => setEditing(r)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setEditing(r); }}
                  style={{ position: 'relative', width: '100%', height: 120, background: '#F5F0E1', cursor: 'pointer' }}
                >
                  {r.public_url ? (
                    isVideoRow(r) ? (
                      <video
                        src={r.public_url}
                        preload="metadata"
                        muted
                        playsInline
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget;
                          const d = Number.isFinite(v.duration) ? v.duration : 0;
                          v.currentTime = d > 0 ? Math.min(d * 0.1, 3) : 0;
                        }}
                        style={{ width:'100%', height:'100%', objectFit:'cover', background:'#F5F0E1', display:'block' }}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.public_url} alt={r.original_filename ?? ''} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    )
                  ) : (
                    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:INK_M }}>no preview</div>
                  )}
                  <div style={{ position:'absolute', top:6, left:6, display:'flex', gap:4, flexWrap:'wrap', maxWidth:'75%' }}>
                    {badges.map(b => (
                      <span key={b.k} style={{
                        background: b.bg ?? RED, color: b.fg ?? WHITE, fontSize: 10, fontWeight: 700,
                        padding: '2px 6px', borderRadius: 3, letterSpacing: '0.02em',
                      }}>{b.label}</span>
                    ))}
                  </div>
                  {/* QA badge — bottom-right */}
                  <div title={r.quality_index != null ? 'Quality index ' + r.quality_index + '%' : 'Not scored yet'} style={{
                    position:'absolute', right:4, bottom:4,
                    background: qBadge.bg, color: qBadge.fg,
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                    letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                  }}>{qBadge.label}</div>
                  {r.public_url && isVideoRow(r) && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Play video"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setPlaying(r); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); setPlaying(r); } }}
                      style={{
                        position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)',
                        width:28, height:28, borderRadius:14, background:'#084838',
                        color:'#FFFFFF', fontSize:12, cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700,
                        boxShadow:'0 2px 8px rgba(0,0,0,0.3)', zIndex:2,
                      }}
                    >▶</span>
                  )}
                </div>
                <div style={{ padding:'6px 8px', borderTop:'1px solid '+HAIR, fontSize:10 }}>
                  <div
                    title={r.original_filename ? 'Original: ' + r.original_filename : undefined}
                    style={{ color:INK, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                  >
                    {displayName(r)}
                  </div>
                  {/* SCOPE 3 · inline area dropdown — one-click file to a Settings-driven area or destination folder */}
                  {taxonomyGroups.length > 0 ? (
                    <div style={{ marginTop:4 }} onClick={(e) => e.stopPropagation()}>
                      <select
                        aria-label="Assign area"
                        disabled={busyId === r.asset_id}
                        defaultValue=""
                        onChange={(e) => {
                          const [kind, key] = e.target.value.split('::');
                          if (!kind) return;
                          const tr = areaTaxonomy.find(t => t.kind === kind && t.area_key === key);
                          if (tr) inlineAssign(r, tr);
                          e.currentTarget.value = '';
                        }}
                        style={{
                          width:'100%', fontSize:10, padding:'4px 6px',
                          border:'1px solid '+HAIR, background: WHITE, color: INK,
                          borderRadius:3, cursor: busyId === r.asset_id ? 'wait' : 'pointer',
                        }}
                      >
                        <option value="">— assign area…</option>
                        {taxonomyGroups.map(g => (
                          <optgroup key={g.kind} label={g.label}>
                            {g.rows.map(tr => (
                              <option key={g.kind + '::' + tr.area_key} value={g.kind + '::' + tr.area_key}>
                                {tr.name}{tr.photo_count != null ? ' · ' + tr.photo_count : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ color:INK_M, marginTop:2 }}>Click to edit ✎</div>
                  )}
                  {/* PBS 2026-07-21 · Review-into-Clarify merge — per-row action row.
                      Edit opens AssetEditDrawer (LibraryTab pattern). Keep/Archive/
                      Delete port ReviewTab handlers. Keep is DISABLED until
                      property_area + primary_tier are set (see canKeep) — prevents
                      the "photo disappeared" burn when clearing review before
                      classification. */}
                  <div style={{ display: 'flex', gap: 3, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditing(r)}
                      title="Open full editor (area, tier, alt text, etc.)"
                      style={{
                        flex: 1, padding: '4px 6px', fontSize: 10, fontWeight: 600,
                        background: WHITE, color: INK, border: '1px solid ' + INK,
                        borderRadius: 3, cursor: 'pointer',
                      }}
                    >Edit</button>
                    <button
                      onClick={() => canKeep && clearFlag(r.asset_id)}
                      disabled={!canKeep || busyId === r.asset_id}
                      title={canKeep ? 'Clear review flag' : 'Assign area + tier via Edit first'}
                      style={{
                        flex: 1, padding: '4px 6px', fontSize: 10, fontWeight: 600,
                        background: WHITE, color: canKeep ? FOREST : INK_M,
                        border: '1px solid ' + (canKeep ? FOREST : HAIR),
                        borderRadius: 3,
                        cursor: !canKeep ? 'not-allowed' : (busyId === r.asset_id ? 'wait' : 'pointer'),
                        opacity: canKeep ? 1 : 0.55,
                      }}
                    >Keep</button>
                    <button
                      onClick={() => archiveAsset(r.asset_id)}
                      disabled={busyId === r.asset_id}
                      title="Move to Archive tier — keeps the file, out of active library"
                      style={{
                        flex: 1, padding: '4px 6px', fontSize: 10, fontWeight: 600,
                        background: WHITE, color: '#B87F26', border: '1px solid #B87F26',
                        borderRadius: 3, cursor: busyId === r.asset_id ? 'wait' : 'pointer',
                      }}
                    >Archive</button>
                    <button
                      onClick={() => confirmJunk(r.asset_id, r.original_filename)}
                      disabled={busyId === r.asset_id}
                      title="Confirm as junk — soft-delete (reversible)"
                      style={{
                        flex: 1, padding: '4px 6px', fontSize: 10, fontWeight: 600,
                        background: WHITE, color: RED, border: '1px solid ' + RED,
                        borderRadius: 3, cursor: busyId === r.asset_id ? 'wait' : 'pointer',
                      }}
                    >Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AssetEditDrawer
        open={editing != null}
        onClose={() => setEditing(null)}
        asset={editing as AssetEditRow | null}
        areaOptions={areaOptions}
        rooms={rooms}
        taxonomy={taxonomy}
        onSaved={async (updated) => {
          if (!updated?.asset_id) return;
          const id = updated.asset_id;
          try {
            // 1) Re-score with new context (area, tier changed)
            await fetch('/api/marketing/media/qa-rescore', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ asset_id: id }),
            });
            // 2) Regenerate SEO filename + alt/caption (Iris)
            await fetch('/api/marketing/media/apply-iris-filename', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ asset_id: id }),
            });
            // 3) Clear needs_review — auto-drop from Clarify list
            await fetch('/api/marketing/media/clear-review', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ asset_id: id }),
            });
            setMsg('Photo classified · re-scored · SEO filename regenerated · moved to Library.');
            setTimeout(() => setMsg((m) => m === 'Photo classified · re-scored · SEO filename regenerated · moved to Library.' ? null : m), 4000);
          } catch (e) {
            console.error('[clarify post-save chain]', e);
          }
          // Existing behaviour: drop from local list
          setLocalDismiss(s => new Set(s).add(id));
        }}
      />

      <VideoPlayerModal
        open={playing != null}
        onClose={() => setPlaying(null)}
        asset={playing as VideoPlayerAsset | null}
      />
    </div>
  );
}