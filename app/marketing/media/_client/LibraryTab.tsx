// app/marketing/media/_client/LibraryTab.tsx
// PBS 2026-07-12 — Library tab. KPIs, tier filter, grid, upload.
// 2026-07-12 (later) — Edit button opens AssetEditDrawer for 6 mutable columns.
// 2026-07-13 · MEDIA QA v1 — tile now shows a bottom-right quality badge
//   (FOREST 80+ · CREAM 60-79 · AMBER 40-59 · RED <40 · HAIR unscored).
// 2026-07-14 · TASK 1 — Library now hides untagged photos (Clarify-only domain).
// 2026-07-14 · MEDIA QA v2 — tile filename shows seo_target_filename (Iris SEO)
//   with original_filename kept as a hover tooltip. Search matches both.
// 2026-07-14 · TASK 2 — "All areas" dropdown is now data-driven from
//   /api/marketing/media/area-facets (DISTINCT property_area + counts). The old
//   Settings-taxonomy list (rooms/facilities/activities/etc) surfaced fine-grained
//   entries that yield 0 photos because tagging uses coarse values like
//   pool/restaurant/rooms/grounds/lifestyle. Taxonomy stays for AssetEditDrawer.
// PBS 2026-07-17 · media-pipeline-frontend brief · SCOPE 4/6 — Destination
//   optgroup fed by threaded areaTaxonomy prop (Luang Prabang / Laos / People /
//   Ban Done Keo Village) + relabelled Uncategorized + compact orphan/tiff admin
//   panel below the grid (fed by /api/marketing/media/ingest-problems).
'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import UploadDropzone from './UploadDropzone';
import AssetEditDrawer, { type AssetEditRow, type DrawerTaxonomy } from './AssetEditDrawer';
import LibraryOtaProposer from './LibraryOtaProposer';
import BulkSelectBar from './BulkSelectBar';
import { qaBadge } from '@/lib/mediaQa';

interface TierRow { primary_tier: string | null; total: number | string; photos: number | string; videos: number | string; }
interface MediaRow {
  asset_id: string; asset_type?: string; original_filename: string;
  seo_target_filename?: string | null;
  caption: string | null; primary_tier: string | null; property_area: string | null;
  captured_at?: string | null; qc_score: number | null; public_url: string | null;
  width_px: number | null; height_px: number | null;
  master_path?: string | null; mime_type?: string | null; status?: string | null;
  file_size_bytes?: number | string | null; file_size_human?: string | null;
  alt_text?: string | null; is_ai_generated?: boolean | null;
  created_at?: string | null;
  technical_score?: number | null; aesthetic_score?: number | null; marketing_score?: number | null;
  quality_index?: number | null; qa_notes?: any; qa_model?: string | null; qa_scored_at?: string | null;
}

// PBS 2026-07-14 · prefer Iris SEO filename on the tile, original stays as tooltip.
function displayName(r: MediaRow): string {
  const seo = (r.seo_target_filename ?? '').trim();
  if (seo) return seo;
  return (r.original_filename ?? '').trim() || r.asset_id.slice(0, 8);
}
interface ChannelSpec { channel: string; display_name: string; min_quality_score?: number | null; image_min_width?: number | null; image_min_height?: number | null; }

export interface LibraryAreaTaxonomyRow {
  property_id: number;
  kind: string;
  sort_order: number;
  ref_id: string | null;
  area_key: string;
  name: string;
  extra: string | null;
  photo_count: number | null;
}
export interface LibraryCountsProp {
  property_id: number;
  pics_ready: number; videos_total: number; with_tier: number; with_area: number;
  to_clarify: number; destination: number; review_junk: number;
  website: number; ota: number; social: number; internal: number;
}

interface Props {
  propertyId: number;
  byTier: TierRow[];
  mediaPage: MediaRow[];
  channelSpecs: ChannelSpec[];
  onSendToAi?: (assetId: string) => void;
  areaOptions?: string[];
  rooms?: Array<{ room_type_id: number; room_type_name: string }>;
  taxonomy?: DrawerTaxonomy;
  areaTaxonomy?: LibraryAreaTaxonomyRow[];
  libraryCounts?: LibraryCountsProp | null;
}

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const PAGE_SIZE = 24;

const TOP_FILTERS: Array<{ k: 'all'|'top100'|'topRooms'|'topFacilities'; label: string }> = [
  { k: 'all',           label: 'All' },
  { k: 'top100',        label: 'Top 100' },
  { k: 'topRooms',      label: 'Top rooms · 8/room' },
  { k: 'topFacilities', label: 'Top facilities · 5/facility' },
];

// PBS 2026-07-17 · tier chips — merged OTA + Website (same quality bar);
// Internal is empty after re-tier so removed from the strip.
const TIER_CHIPS: Array<{ key: string; label: string }> = [
  { key: '',                  label: 'All'          },
  { key: 'tier_ota_profile',  label: 'OTA / Website'},
  { key: 'tier_social_pool',  label: 'Social'   },
  { key: 'tier_logos',        label: 'Logos'    },
  { key: 'tier_archive',      label: 'Archive'  },
];

function n(v: any): number { return Number(v ?? 0); }

export default function LibraryTab({ propertyId, byTier, mediaPage, channelSpecs, onSendToAi, areaOptions = [], rooms = [], taxonomy, areaTaxonomy = [], libraryCounts: libraryCountsProp = null }: Props) {
  const [tier, setTier] = useState<string>('');
  const [page, setPage] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [useForMenu, setUseForMenu] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastDownload, setLastDownload] = useState<{ url: string; label: string } | null>(null);
  const [localDismiss, setLocalDismiss] = useState<Set<string>>(new Set());
  // PBS 2026-07-14 · #203 · bulk-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => setSelectedIds(s => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const clearSelection = () => setSelectedIds(new Set());
  const [editing, setEditing] = useState<MediaRow | null>(null);

  const totals = useMemo(() => {
    const tot = byTier.reduce((s, r) => s + n(r.total), 0);
    const ota = n(byTier.find(r => r.primary_tier === 'tier_ota_profile')?.total);
    const hero = n(byTier.find(r => r.primary_tier === 'tier_website_hero')?.total);
    const social = n(byTier.find(r => r.primary_tier === 'tier_social_pool')?.total);
    const internal = n(byTier.find(r => r.primary_tier === 'tier_internal')?.total);
    return { tot, ota, hero, social, internal };
  }, [byTier]);

  const [searchText, setSearchText] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [aiOnly, setAiOnly] = useState(false);
  // PBS 2026-07-14 · quick top-N filters
  type TopFilter = 'all' | 'top100' | 'topRooms' | 'topFacilities';
  const [topFilter, setTopFilter] = useState<TopFilter>('all');
  type FacetRow = { kind: string; sort_order: number; ref_id: string; area_key: string; name: string; extra: string | null; photo_count: number };
  type FacetGroups = Record<'rooms'|'facilities'|'activities'|'certifications'|'team'|'other'|'uncategorized', FacetRow[]>;
  const [facetGroups, setFacetGroups] = useState<FacetGroups | null>(null);

  // PBS 2026-07-17 · SCOPE 1 · media-pipeline-frontend brief.
  // Canonical stat-tile counts come from public.v_media_library_counts (ADR-149).
  // Kills the 832-vs-1125 client-side recompute bug — tiles below read libCounts.
  interface LibraryCounts {
    pics_ready: number; videos_total: number; with_tier: number; with_area: number;
    to_clarify: number; destination: number; review_junk: number;
    website: number; ota: number; social: number; internal: number;
  }
  // PBS 2026-07-17 · Scope 1 seed — start from server-loaded row if page.tsx
  // already fetched v_media_library_counts (avoids first-tick tile flash).
  const [libCounts, setLibCounts] = useState<LibraryCounts | null>(libraryCountsProp);

  // Scope 6 · ingest problems (orphan raw paths + tiff/heic mime) — served by
  // /api/marketing/media/ingest-problems (public.v_media_ingest_status only).
  interface IngestProblem {
    queue_id: number; status: string; storage_path: string | null; detected_mime: string | null;
    size_mb: number | null; retries: number; last_attempt_at: string | null; asset_id: string | null;
    problem: string;
  }
  const [problems, setProblems] = useState<IngestProblem[]>([]);
  const [problemsOpen, setProblemsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/marketing/media/area-facets', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;
        if (j?.groups) setFacetGroups(j.groups as FacetGroups);
      } catch { /* silent — fallback to static options */ }
    })();
    // Fetch canonical library counts (SCOPE 1). Only re-fetch client-side if
    // the server-side prop wasn't provided, or to refresh after a slow update.
    (async () => {
      try {
        const res = await fetch('/api/marketing/media/library-counts', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;
        if (j?.counts) setLibCounts(j.counts as LibraryCounts);
      } catch { /* silent — falls back to legacy byTier totals */ }
    })();
    // Fetch ingest problems (SCOPE 6).
    (async () => {
      try {
        const res = await fetch('/api/marketing/media/ingest-problems', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;
        if (Array.isArray(j?.rows)) setProblems(j.rows as IngestProblem[]);
      } catch { /* silent — panel simply stays empty */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const isFullyTagged = (r: MediaRow) => {
    if (!r.primary_tier) return false;
    if (r.property_area && r.property_area.trim() !== '') return true;
    const anyFk = (r as any).room_type_id || (r as any).facility_id || (r as any).activity_id || (r as any).certification_id || (r as any).contact_id;
    return !!anyFk;
  };

  const filtered = useMemo(() => {
    let out = mediaPage.filter(r =>
      ((r.asset_type ?? '').toLowerCase() !== 'video') &&
      !((r.mime_type ?? '').toLowerCase().startsWith('video/')) &&
      isFullyTagged(r)
    );
    if (tier)         out = out.filter(r => r.primary_tier === tier);
    if (areaFilter) {
      const key = areaFilter;
      const [prefix, rest] = key.includes(':') ? key.split(':', 2) : [key, ''];
      if (prefix === 'room')     out = out.filter(r => String((r as any).room_type_id ?? '') === rest);
      else if (prefix === 'facility') out = out.filter(r => String((r as any).facility_id ?? '') === rest);
      else if (prefix === 'activity') out = out.filter(r => String((r as any).activity_id ?? '') === rest);
      else if (prefix === 'cert')     out = out.filter(r => String((r as any).certification_id ?? '') === rest);
      else if (prefix === 'contact')  out = out.filter(r => String((r as any).contact_id ?? '') === rest);
      // SCOPE 4 · destination folder filter — match on lowercased property_area
      // slug (fn_place_destination stores the slug there) OR on destination_id
      // if the row surfaces it.
      else if (prefix === 'dest') {
        const slug = rest.toLowerCase();
        out = out.filter(r => {
          const area = String((r as any).property_area ?? '').toLowerCase();
          const destId = String((r as any).destination_id ?? '').toLowerCase();
          return area === slug || destId === slug;
        });
      }
      else if (key === 'other:rooms')      out = out.filter(r => !(r as any).room_type_id && !(r as any).facility_id && !(r as any).activity_id && String((r as any).category ?? '').toLowerCase().startsWith('room'));
      else if (key === 'other:facilities') out = out.filter(r => !(r as any).room_type_id && !(r as any).facility_id && !(r as any).activity_id && ['f&b','pool','lobby','exterior'].includes(String((r as any).category ?? '').toLowerCase()));
      else if (key === 'other:activities') out = out.filter(r => !(r as any).room_type_id && !(r as any).facility_id && !(r as any).activity_id && String((r as any).category ?? '').toLowerCase().startsWith('activit'));
      else if (key === 'uncategorized')    out = out.filter(r => !(r as any).room_type_id && !(r as any).facility_id && !(r as any).activity_id && !(r as any).certification_id && !(r as any).contact_id);
    }
    if (aiOnly)       out = out.filter((r: any) => r.is_ai_generated === true);
    if (searchText) {
      const q = searchText.toLowerCase();
      out = out.filter(r =>
        (r.original_filename     ?? '').toLowerCase().includes(q) ||
        (r.seo_target_filename   ?? '').toLowerCase().includes(q) ||
        (r.property_area         ?? '').toLowerCase().includes(q)
      );
    }
    if (topFilter === 'top100') {
      // PBS 2026-07-15 · Top 100 = property-wide showcase — no room photos + max 15 per category so F&B doesn''t dominate
      const sorted = [...out]
        .filter(r => !(r as any).room_type_id)
        .sort((a, b) => (b.quality_index ?? 0) - (a.quality_index ?? 0));
      const perCat = new Map<string, number>();
      const picked: MediaRow[] = [];
      for (const r of sorted) {
        if (picked.length >= 100) break;
        const cat = String((r as any).category ?? 'other').toLowerCase();
        const n = perCat.get(cat) ?? 0;
        if (n >= 15) continue;
        picked.push(r);
        perCat.set(cat, n + 1);
      }
      out = picked;
    } else if (topFilter === 'topRooms') {
      const bucketed = new Map<string, MediaRow[]>();
      for (const r of [...out].sort((a, b) => (b.quality_index ?? 0) - (a.quality_index ?? 0))) {
        const k = String((r as any).room_type_id ?? ''); if (!k) continue;
        const arr = bucketed.get(k) ?? [];
        if (arr.length < 8) arr.push(r);
        bucketed.set(k, arr);
      }
      out = [...bucketed.values()].flat();
    } else if (topFilter === 'topFacilities') {
      const bucketed = new Map<string, MediaRow[]>();
      for (const r of [...out].sort((a, b) => (b.quality_index ?? 0) - (a.quality_index ?? 0))) {
        const k = String((r as any).facility_id ?? ''); if (!k) continue;
        const arr = bucketed.get(k) ?? [];
        if (arr.length < 5) arr.push(r);
        bucketed.set(k, arr);
      }
      out = [...bucketed.values()].flat();
    }
    return out;
  }, [mediaPage, tier, areaFilter, aiOnly, searchText, topFilter]);

  const visible = filtered.filter(r => !localDismiss.has(r.asset_id));
  const pageRows = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  async function deleteAsset(assetId: string, filename: string | null) {
    if (!window.confirm('Delete "' + (filename ?? assetId.slice(0,8)) + '" from the library? (soft-delete, can be restored via SQL)')) return;
    setBusyRow(assetId); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/asset-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'delete_failed');
      setLocalDismiss(s => { const next = new Set(s); next.add(assetId); return next; });
      setMsg('Deleted ' + (filename ?? assetId.slice(0,8)) + ' — refresh to sync');
    } catch (e: any) { setMsg('Delete failed: ' + e.message); }
    finally { setBusyRow(null); }
  }

  async function renderForChannel(assetId: string, channel: string) {
    setBusyRow(assetId);
    setUseForMenu(null);
    setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/render-for-channel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId, channel, property_id: propertyId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      const dl = j.download_url as string | undefined;
      const label = (j.channel_display ?? channel) + ' · ' + j.width + 'x' + j.height;
      if (dl) {
        const proxyUrl = '/api/marketing/media/download-render?asset_id=' + assetId + '&channel=' + encodeURIComponent(channel);
        setLastDownload({ url: proxyUrl, label });
        setMsg('Rendered for ' + label + ' — download started');
        const proxy = '/api/marketing/media/download-render?asset_id=' + assetId + '&channel=' + encodeURIComponent(channel);
        const link = document.createElement('a'); link.href = proxy; link.download = j.filename_hint ?? '';
        document.body.appendChild(link); link.click(); link.remove();
      } else {
        setMsg('Rendered for ' + channel + ' — queued as ' + (j.render_id ?? 'render'));
      }
    } catch (e: any) {
      setMsg('Failed: ' + e.message);
    } finally {
      setBusyRow(null);
    }
  }

  return (
    <div>
      <div style={{ marginBottom:12 }}>
        <LibraryOtaProposer propertyId={propertyId} totalRooms={rooms.length || 10} />
      </div>
      <BulkSelectBar
        selectedIds={Array.from(selectedIds)}
        onClear={clearSelection}
        rooms={rooms.map(r => ({ id: r.room_type_id, name: r.room_type_name }))}
        facilities={(taxonomy?.facilities ?? []).map(f => ({ id: f.id, name: f.name }))}
        activities={(taxonomy?.activities ?? []).map(a => ({ id: a.id, name: a.name }))}
        areaChoices={['restaurant','lifestyle','grounds','pool','bar','lobby','wellness','behind_scenes','Logos','No area']}
      />
      {/* PBS 2026-07-17 · SCOPE 1 · tiles bound to v_media_library_counts.
          Fallback to legacy byTier totals only when libCounts is not yet loaded
          (keeps first-render smooth; correct numbers land within one tick). */}
      {/* PBS 2026-07-17 · clickable tiles ARE the tier filter. All tiers live
          here (OTA/Website · Social · Archive · Logos). Click active tile again
          to clear — no more hunting for a "Clear" button. */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8, marginBottom:16 }}>
        {([
          { label: 'Pics',           value: libCounts?.pics_ready   ?? totals.tot,                                                filterTier: null   },
          { label: 'Videos',         value: libCounts?.videos_total ?? 0,                                                          filterTier: null   },
          { label: 'Total ready',    value: libCounts?.pics_ready   ?? totals.tot,                                                filterTier: null   },
          { label: 'With tier',      value: libCounts?.with_tier    ?? totals.tot,                                                filterTier: null   },
          { label: 'With area',      value: libCounts?.with_area    ?? 0,                                                          filterTier: null   },
          { label: 'To clarify',     value: libCounts?.to_clarify   ?? 0,                                                          filterTier: null   },
          { label: 'OTA / Website',  value: (libCounts?.ota ?? totals.ota) + (libCounts?.website ?? totals.hero),                  filterTier: 'tier_ota_profile' },
          { label: 'Social',         value: libCounts?.social       ?? totals.social,                                             filterTier: 'tier_social_pool' },
          { label: 'Archive',        value: n(byTier.find(r => r.primary_tier === 'tier_archive')?.total),                        filterTier: 'tier_archive' },
          { label: 'Logos',          value: n(byTier.find(r => r.primary_tier === 'tier_logos')?.total),                          filterTier: 'tier_logos' },
        ] as Array<{ label: string; value: number | undefined; filterTier: string | null }>).map((t, i) => {
          const isActive    = t.filterTier !== null && tier === t.filterTier;
          const isClickable = t.filterTier !== null;
          return (
            <button
              key={i}
              onClick={isClickable ? () => { setTier(isActive ? '' : (t.filterTier as string)); setPage(0); } : undefined}
              disabled={!isClickable}
              style={{
                textAlign:'left', padding:'12px 14px', borderRadius:6,
                background: isActive ? FOREST : WHITE,
                border:'1px solid ' + (isActive ? FOREST : HAIR),
                color: isActive ? WHITE : INK,
                cursor: isClickable ? 'pointer' : 'default',
                fontFamily:'inherit',
              }}
              title={isClickable ? (isActive ? 'Click again to clear filter' : 'Click to filter to this tier') : undefined}
            >
              <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color: isActive ? WHITE : INK_M, marginBottom:4, opacity: isActive ? 0.85 : 1 }}>{t.label}</div>
              <div style={{ fontSize:22, fontWeight:700, color: isActive ? WHITE : INK }}>{(t.value ?? 0).toLocaleString()}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <input value={searchText} onChange={e => { setSearchText(e.target.value); setPage(0); }} placeholder="Search filename / area" style={{ flex:'1 1 200px', minWidth:180, padding:'6px 10px', fontSize:11, border:'1px solid '+HAIR, borderRadius:3, color:INK, background:WHITE }} />
        <select value={areaFilter} onChange={e => { setAreaFilter(e.target.value); setPage(0); }} style={{ padding:'6px 10px', fontSize:11, border:'1px solid '+HAIR, borderRadius:3, color:INK, background:WHITE, minWidth:220 }}>
          <option value="">All areas</option>
          {facetGroups ? (
            <>
              {facetGroups.rooms.length > 0 && (<optgroup label="Rooms">{facetGroups.rooms.map(f => <option key={f.area_key} value={f.area_key}>{f.name + ' · ' + f.photo_count.toLocaleString()}</option>)}</optgroup>)}
              {facetGroups.facilities.length > 0 && (<optgroup label="Facilities">{facetGroups.facilities.map(f => <option key={f.area_key} value={f.area_key}>{f.name + ' · ' + f.photo_count.toLocaleString()}</option>)}</optgroup>)}
              {facetGroups.activities.length > 0 && (<optgroup label="Activities">{facetGroups.activities.map(f => <option key={f.area_key} value={f.area_key}>{f.name + ' · ' + f.photo_count.toLocaleString()}</option>)}</optgroup>)}
              {facetGroups.certifications.length > 0 && (<optgroup label="Certifications">{facetGroups.certifications.map(f => <option key={f.area_key} value={f.area_key}>{f.name + ' · ' + f.photo_count.toLocaleString()}</option>)}</optgroup>)}
              {facetGroups.team.length > 0 && (<optgroup label="Team">{facetGroups.team.map(f => <option key={f.area_key} value={f.area_key}>{f.name + ' · ' + f.photo_count.toLocaleString()}</option>)}</optgroup>)}
              {facetGroups.other.length > 0 && (<optgroup label="Review — needs human sort">{facetGroups.other.map(f => <option key={f.area_key} value={f.area_key}>{f.name + ' · ' + f.photo_count.toLocaleString()}</option>)}</optgroup>)}
              {/* SCOPE 4 · destination folders — Luang Prabang / Laos / People / Ban Done Keo Village */}
              {areaTaxonomy.filter(r => r.kind === 'destination').length > 0 && (
                <optgroup label="Destination">
                  {areaTaxonomy.filter(r => r.kind === 'destination').map(r => (
                    <option key={'dest::' + r.area_key} value={'dest:' + r.area_key}>
                      {r.name + (r.photo_count != null ? ' · ' + r.photo_count.toLocaleString() : '')}
                    </option>
                  ))}
                </optgroup>
              )}
              {/* SCOPE 4 · Uncategorized relabelled — routing moved lifestyle→destination */}
              {facetGroups.uncategorized.length > 0 && (<optgroup label="Uncategorized (genuine unknowns)">{facetGroups.uncategorized.map(f => <option key={f.area_key} value={f.area_key}>{f.name + ' · ' + f.photo_count.toLocaleString()}</option>)}</optgroup>)}
            </>
          ) : (
            <option disabled>Loading…</option>
          )}
        </select>
        <button onClick={() => { setAiOnly(v => !v); setPage(0); }} style={{ padding:'4px 10px', fontSize:11, borderRadius:12, cursor:'pointer', border:'1px solid '+(aiOnly ? FOREST : HAIR), background: aiOnly ? FOREST : WHITE, color: aiOnly ? WHITE : INK, fontWeight: aiOnly ? 600 : 400, whiteSpace:'nowrap' }}>AI only</button>
        {(TOP_FILTERS).map(f => {
          const active = topFilter === f.k;
          return (
            <button key={'tf-'+f.k} onClick={() => { setTopFilter(f.k); setPage(0); }} style={{
              padding:'4px 10px', fontSize:11, borderRadius:12, cursor:'pointer',
              border:'1px solid '+(active ? FOREST : HAIR),
              background: active ? FOREST : WHITE, color: active ? WHITE : INK,
              fontWeight: active ? 600 : 400, whiteSpace:'nowrap',
            }}>{f.label}</button>
          );
        })}
        {/* PBS 2026-07-17 · tier chips retired — the tiles above are now
            clickable and are the single-source tier filter. The dead
            "Internal" chip that showed 0-hits after re-tier is gone too. */}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:INK_M }}>{filtered.length.toLocaleString()} tagged photos shown</span>
          <button onClick={() => setSelectedIds(s => { const next = new Set(s); for (const r of pageRows) next.add(r.asset_id); return next; })} style={{ padding:'4px 10px', fontSize:11, background:WHITE, color:INK, border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer', whiteSpace:'nowrap' }} title="Add all visible photos on this page to the selection">✓ Select all on page</button>
          <button onClick={() => setShowUpload(v => !v)} style={{
            padding:'6px 14px', fontSize:12, fontWeight:600, background:FOREST, color:WHITE,
            border:'none', borderRadius:4, cursor:'pointer',
          }}>{showUpload ? 'Hide upload' : '+ Upload'}</button>
        </div>
      </div>

      {showUpload && (
        <div style={{ marginBottom:16 }}>
          <UploadDropzone onResult={r => setMsg(r)} />
        </div>
      )}

      {msg && (
        <div style={{ padding:'8px 12px', background:'#F7F0E1', border:'1px solid '+HAIR, borderRadius:4, marginBottom:12, fontSize:12, color:INK }}>
          {msg} <button onClick={() => setMsg(null)} style={{ marginLeft:8, background:'none', border:'none', cursor:'pointer', color:INK_M }}>x</button>
        </div>
      )}

      {pageRows.length === 0 ? (
        <div style={{ padding:40, textAlign:'center', color:INK_M, background:WHITE, border:'1px solid '+HAIR, borderRadius:4 }}>
          No assets match this filter.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12 }}>
          {pageRows.map(r => {
            const badge = qaBadge(r.quality_index ?? null);
            return (
            <div key={r.asset_id} style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:4, overflow:'hidden', display:'flex', flexDirection:'column' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.asset_id)}
                  onChange={() => toggleSelect(r.asset_id)}
                  style={{ position:'absolute', top:6, left:6, zIndex:5, width:18, height:18, cursor:'pointer', accentColor: FOREST }}
                  title="Select for bulk actions"
                />
                {r.public_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.public_url} alt={r.original_filename} loading="lazy"
                    style={{ width:'100%', aspectRatio:'16/9', minHeight:160, objectFit:'cover', background:'#F5F0E1', display:'block' }} />
                ) : (
                  <div style={{ width:'100%', aspectRatio:'16/9', minHeight:160, background:'#F5F0E1', color:INK_M, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>no preview</div>
                )}
                <div title={r.quality_index != null ? 'Quality index ' + r.quality_index + '%' : 'Not scored yet'} style={{
                  position: 'absolute', right: 4, bottom: 4,
                  background: badge.bg, color: badge.fg,
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 3,
                  letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }}>{badge.label}</div>
              </div>
              <div style={{ padding:'6px 8px', fontSize:10, color:INK, borderTop:'1px solid '+HAIR, flex:1, display:'flex', flexDirection:'column', gap:4 }}>
                <div
                  title={r.original_filename ? 'Original: ' + r.original_filename : undefined}
                  style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                >{displayName(r)}</div>
                <div style={{ color:INK_M, display:'flex', gap:6, flexWrap:'wrap' }}>
                  {r.primary_tier && <span>{r.primary_tier}</span>}
                  {r.property_area && <span>{r.property_area}</span>}
                </div>
                <div style={{ marginTop:'auto', display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                  <button onClick={() => setEditing(r)} style={{
                    padding:'4px 10px', fontSize:11, fontWeight:600, background:'transparent', color:INK,
                    border:'1px solid '+INK, borderRadius:2, cursor:'pointer', whiteSpace:'nowrap',
                  }}>Edit</button>
                  <button onClick={() => deleteAsset(r.asset_id, r.original_filename ?? null)} disabled={busyRow === r.asset_id} title="Delete from library (soft-delete)" style={{
                    padding:'4px 8px', fontSize:11, fontWeight:600, background:'transparent', color:'#B23A2E',
                    border:'1px solid #B23A2E', borderRadius:2, cursor:'pointer', whiteSpace:'nowrap',
                  }}>Delete</button>
                  <button onClick={() => setUseForMenu(useForMenu === r.asset_id ? null : r.asset_id)} disabled={busyRow === r.asset_id} style={{
                    fontSize:10, padding:'4px 8px', background:WHITE, border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer', color:INK,
                  }}>Use for</button>
                  {busyRow === r.asset_id && <span style={{ fontSize:10, color:INK_M }}>...</span>}
                </div>
                {useForMenu === r.asset_id && (
                  <div style={{ marginTop:4, background:WHITE, border:'1px solid '+HAIR, borderRadius:3, padding:4, maxHeight:160, overflow:'auto' }}>
                    {onSendToAi && (
                      <button onClick={() => { onSendToAi(r.asset_id); setUseForMenu(null); }} style={{
                        display:'block', width:'100%', textAlign:'left', padding:'6px 8px', fontSize:11, fontWeight:600, background:'#F5F1E6', border:'none', borderBottom:'1px solid '+HAIR, cursor:'pointer', color:FOREST,
                      }}>AI Studio (refine / restyle)</button>
                    )}
                    {channelSpecs.map(c => {
                      const q  = (r.quality_index ?? null) as number | null;
                      const wq = (c.min_quality_score ?? null) as number | null;
                      const wW = (c.image_min_width  ?? null) as number | null;
                      const wH = (c.image_min_height ?? null) as number | null;
                      const failScore = wq != null && q  != null && q  < wq;
                      const failW     = wW != null && r.width_px  != null && r.width_px  < wW;
                      const failH     = wH != null && r.height_px != null && r.height_px < wH;
                      const unknown   = (wq != null && q == null) || ((wW != null || wH != null) && (r.width_px == null || r.height_px == null));
                      const blocked   = failScore || failW || failH;
                      const parts: string[] = [];
                      if (failScore)  parts.push('quality ' + q + '% < min ' + wq + '%');
                      if (failW || failH) parts.push('size ' + (r.width_px ?? '?') + '×' + (r.height_px ?? '?') + ' < min ' + (wW ?? '?') + '×' + (wH ?? '?'));
                      if (unknown && parts.length === 0) parts.push('missing quality / dimensions — cannot verify');
                      const reason = parts.join(' · ');
                      return (
                        <Fragment key={c.channel}>
                          <button
                            onClick={() => { if (!blocked) renderForChannel(r.asset_id, c.channel); }}
                            disabled={blocked}
                            title={blocked ? ('Blocked — ' + reason) : (unknown ? ('Warning — ' + reason) : (c.display_name + (wq != null ? ' · min ' + wq + '%' : '')))}
                            style={{
                              display:'block', width:'100%', textAlign:'left', padding:'4px 6px', fontSize:10,
                              background: blocked ? '#F5F0E1' : 'none',
                              border:'none',
                              cursor: blocked ? 'not-allowed' : 'pointer',
                              color: blocked ? INK_M : (unknown ? '#B23A2E' : INK),
                              opacity: blocked ? 0.55 : 1,
                            }}
                          >{c.display_name}{blocked ? ' · blocked' : (unknown ? ' · ?' : '')}</button>
                        </Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16, alignItems:'center' }}>
          <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} style={{
            padding:'4px 10px', fontSize:11, border:'1px solid '+HAIR, background:WHITE, borderRadius:3, cursor: page === 0 ? 'default' : 'pointer', color:INK,
          }}>Prev</button>
          <span style={{ fontSize:11, color:INK_M }}>Page {page + 1} of {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)} style={{
            padding:'4px 10px', fontSize:11, border:'1px solid '+HAIR, background:WHITE, borderRadius:3, cursor: page + 1 >= totalPages ? 'default' : 'pointer', color:INK,
          }}>Next</button>
        </div>
      )}

      {/* SCOPE 6 · orphan / tiff / heic admin panel — actionable list of assets
          the ingest pipeline cannot auto-process. Small, collapsible. */}
      {problems.length > 0 && (
        <div style={{ marginTop: 24, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4 }}>
          <button
            onClick={() => setProblemsOpen(v => !v)}
            style={{
              width: '100%', textAlign: 'left', background: '#FAF7EE',
              border: 'none', borderBottom: problemsOpen ? '1px solid ' + HAIR : 'none',
              padding: '10px 14px', fontSize: 12, fontWeight: 700, color: INK, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, borderRadius: '4px 4px 0 0',
            }}
          >
            <span>Admin · orphan / tiff / heic ({problems.length})</span>
            <span style={{ color: INK_M, fontWeight: 400, fontSize: 11, marginLeft: 'auto' }}>{problemsOpen ? 'hide' : 'show'}</span>
          </button>
          {problemsOpen && (
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F5F0E1' }}>
                    <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid ' + HAIR, color: INK_M, fontWeight: 600 }}>Problem</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid ' + HAIR, color: INK_M, fontWeight: 600 }}>Path</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid ' + HAIR, color: INK_M, fontWeight: 600 }}>MIME</th>
                    <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid ' + HAIR, color: INK_M, fontWeight: 600 }}>Size</th>
                    <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid ' + HAIR, color: INK_M, fontWeight: 600 }}>Retries</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.map(p => (
                    <tr key={p.queue_id}>
                      <td style={{ padding: '4px 10px', borderBottom: '1px solid ' + HAIR, color: '#B23A2E', fontWeight: 600 }}>{p.problem}</td>
                      <td style={{ padding: '4px 10px', borderBottom: '1px solid ' + HAIR, color: INK, fontFamily: 'ui-monospace, Menlo, monospace', maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.storage_path ?? ''}>{p.storage_path ?? '—'}</td>
                      <td style={{ padding: '4px 10px', borderBottom: '1px solid ' + HAIR, color: INK_M }}>{p.detected_mime ?? '—'}</td>
                      <td style={{ padding: '4px 10px', borderBottom: '1px solid ' + HAIR, color: INK_M, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.size_mb != null ? p.size_mb.toFixed(1) + ' MB' : '—'}</td>
                      <td style={{ padding: '4px 10px', borderBottom: '1px solid ' + HAIR, color: INK_M, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.retries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '8px 12px', fontSize: 10, color: INK_M, borderTop: '1px solid ' + HAIR }}>
                Re-upload as JPG/PNG/WebP to bring these into the library. TIFF/HEIC bypass the ingest pipeline.
              </div>
            </div>
          )}
        </div>
      )}

      <AssetEditDrawer
        open={editing != null}
        onClose={() => setEditing(null)}
        asset={editing as AssetEditRow | null}
        areaOptions={areaOptions}
        rooms={rooms}
        taxonomy={taxonomy}
      />
    </div>
  );
}