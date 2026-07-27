// app/marketing/media/_client/VideoTriageTab.tsx
// PBS 2026-07-17 · media-video-frontend brief · scopes 1+3+4+5.
// Single surface for triaging the entire video library:
//   - poster-card grid over public.v_media_videos (293 rows at Namkhan)
//   - filters: video_type · content_class · needs_review · category
//   - click a card → inline <video> player Drawer
//   - inline actions: Keep · Archive · Delete (shared RPCs)
//   - inline area dropdown per card (fed by v_media_area_taxonomy, incl destination)
//   - dormant-state banner when analyzed_at all null (Cloudinary + Gemini keys not set)
// Handles empty poster_path / playable_path gracefully — no bytes-download proxy,
// no error, no attempt to enable the dormant workers.
'use client';

import { useMemo, useState } from 'react';

export interface VideoRow {
  asset_id: string;
  property_id: number | null;
  original_filename: string | null;
  status: string | null;
  content_class: string | null;         // hotel | destination | junk | unknown | null
  video_type: string | null;            // broll | raw_footage | ready_made | ai_generated | unusable
  category: string | null;
  sub_category: string | null;
  caption: string | null;
  usability_score: number | null;
  poster_path: string | null;
  playable_path: string | null;
  duration_sec: number | null;
  width_px: number | null;
  height_px: number | null;
  has_audio: boolean | null;
  needs_review: boolean | null;
  review_reason: string | null;
  analyzed_at: string | null;
  ai_video_notes: any;
  room_type_id: number | null;
  facility_id: number | null;
  activity_id: number | null;
  destination_id: number | null;
  created_at: string | null;
}

export interface AreaTaxonomyRow {
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
  videos: VideoRow[];
  areaTaxonomy: AreaTaxonomyRow[];
}

const WHITE  = '#FFFFFF';
const CREAM  = '#F5F0E1';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const AMBER  = '#B87F26';
const RED    = '#B23A2E';

const VIDEO_TYPE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  broll:        { bg: '#EBF1EE', fg: FOREST, label: 'B-roll' },
  raw_footage:  { bg: CREAM,     fg: INK_M,  label: 'Raw' },
  ready_made:   { bg: '#EBF1EE', fg: FOREST, label: 'Ready-made' },
  ai_generated: { bg: '#F0EAF8', fg: '#5A3A9A', label: 'AI-generated' },
  unusable:     { bg: '#FBE8E4', fg: RED,    label: 'Unusable' },
};

const CONTENT_CLASS_LABEL: Record<string, string> = {
  hotel: 'Hotel', destination: 'Destination', junk: 'Junk', unknown: 'Unknown',
};

const KIND_LABEL: Record<string, string> = {
  rooms: 'Rooms',
  facilities: 'Facilities',
  activities: 'Activities',
  certifications: 'Certifications',
  team: 'Team',
  destination: 'Destination',
  other: 'Other',
  uncategorized: 'Uncategorized',
};

function formatDuration(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return '—';
  const total = Math.round(s);
  const mm = Math.floor(total / 60);
  const ss = String(total % 60).padStart(2, '0');
  return mm + ':' + ss;
}

function usabilityColor(n: number | null): string {
  if (n == null) return HAIR;
  if (n >= 80) return FOREST;
  if (n >= 60) return AMBER;
  return RED;
}

export default function VideoTriageTab({ videos, areaTaxonomy }: Props) {
  const [videoTypeFilter, setVideoTypeFilter] = useState<string>('');
  const [contentClassFilter, setContentClassFilter] = useState<string>('');
  const [needsReviewOnly, setNeedsReviewOnly] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [selected, setSelected] = useState<VideoRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [localDismiss, setLocalDismiss] = useState<Set<string>>(new Set());

  // Scope 5 · dormant banner check — no rows analyzed = Cloudinary/Gemini keys not set.
  const dormant = videos.length > 0 && videos.every((v) => v.analyzed_at == null);

  const taxonomyGroups = useMemo(() => {
    const byKind = new Map<string, AreaTaxonomyRow[]>();
    for (const r of areaTaxonomy) {
      if (!byKind.has(r.kind)) byKind.set(r.kind, []);
      byKind.get(r.kind)!.push(r);
    }
    const order = ['rooms', 'facilities', 'activities', 'certifications', 'team', 'destination', 'other'];
    const groups: Array<{ kind: string; label: string; rows: AreaTaxonomyRow[] }> = [];
    for (const k of order) {
      const rows = byKind.get(k);
      if (rows && rows.length) groups.push({ kind: k, label: KIND_LABEL[k] ?? k, rows });
    }
    return groups;
  }, [areaTaxonomy]);

  const counts = useMemo(() => {
    const total = videos.length;
    const flagged = videos.filter((v) => v.needs_review).length;
    const byType: Record<string, number> = {};
    for (const v of videos) {
      const t = v.video_type ?? '(untyped)';
      byType[t] = (byType[t] ?? 0) + 1;
    }
    const byClass: Record<string, number> = {};
    for (const v of videos) {
      const c = v.content_class ?? '(unclassified)';
      byClass[c] = (byClass[c] ?? 0) + 1;
    }
    return { total, flagged, byType, byClass };
  }, [videos]);

  const filtered = useMemo(() => {
    let out = videos.filter((v) => !localDismiss.has(v.asset_id));
    if (videoTypeFilter)    out = out.filter((v) => (v.video_type ?? '') === videoTypeFilter);
    if (contentClassFilter) out = out.filter((v) => (v.content_class ?? '') === contentClassFilter);
    if (needsReviewOnly)    out = out.filter((v) => v.needs_review === true);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((v) =>
        (v.original_filename ?? '').toLowerCase().includes(q) ||
        (v.caption ?? '').toLowerCase().includes(q) ||
        (v.category ?? '').toLowerCase().includes(q));
    }
    return out;
  }, [videos, videoTypeFilter, contentClassFilter, needsReviewOnly, search, localDismiss]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a.usability_score ?? -1;
      const bv = b.usability_score ?? -1;
      return bv - av;
    });
  }, [filtered]);

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
      setSelected(null);
      setMsg('Review flag cleared');
    } catch (e: any) { setMsg('Keep failed: ' + e.message); }
    finally { setBusyId(null); }
  }

  async function deleteAsset(assetId: string, filename: string | null) {
    if (!window.confirm('Confirm as junk: "' + (filename ?? assetId.slice(0,8)) + '"? (soft-delete, reversible)')) return;
    setBusyId(assetId); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/confirm-junk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'junk_failed');
      setLocalDismiss((s) => { const next = new Set(s); next.add(assetId); return next; });
      setSelected(null);
      setMsg('Confirmed as junk');
    } catch (e: any) { setMsg('Delete failed: ' + e.message); }
    finally { setBusyId(null); }
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
      setSelected(null);
      setMsg('Archived');
    } catch (e: any) { setMsg('Archive failed: ' + e.message); }
    finally { setBusyId(null); }
  }

  async function inlineAssign(row: VideoRow, taxRow: AreaTaxonomyRow) {
    setBusyId(row.asset_id); setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        asset_id: row.asset_id,
        kind: taxRow.kind,
        ref_id: taxRow.kind === 'destination' ? (taxRow.ref_id ?? taxRow.area_key) : (taxRow.ref_id ?? null),
        area_key: taxRow.area_key,
      };
      const res = await fetch('/api/marketing/media/clarify-assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'assign_failed');
      setLocalDismiss((s) => new Set(s).add(row.asset_id));
      setMsg('Filed to ' + taxRow.name);
    } catch (e: any) { setMsg('Assign failed: ' + e.message); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      {/* Scope 5 · dormant-state banner */}
      {dormant && (
        <div style={{
          background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4,
          padding: '10px 14px', marginBottom: 12, fontSize: 12, color: INK,
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <strong style={{ color: AMBER }}>Video AI not enabled</strong>
          <span style={{ color: INK_M }}>
            · Cards render from filename classification only (video_type · category). Posters + inline playback come online once GEMINI_API_KEY and CLOUDINARY_URL are set and fn_video_pipeline_start() runs.
          </span>
        </div>
      )}

      {/* Header + filter chips */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Video Library — triage without watching</div>
          <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>
            {counts.total.toLocaleString()} clips · {counts.flagged} flagged · sort by usability
          </div>
        </div>
        <div style={{ fontSize: 11, color: INK_M }}>{sorted.length.toLocaleString()} shown</div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search filename / caption / category"
          style={{ flex: '1 1 220px', minWidth: 200, padding: '6px 10px', fontSize: 11, border: '1px solid ' + HAIR, borderRadius: 3, color: INK, background: WHITE }}
        />
        <select value={videoTypeFilter} onChange={(e) => setVideoTypeFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 11, border: '1px solid ' + HAIR, borderRadius: 3, color: INK, background: WHITE }}>
          <option value="">All types</option>
          {Object.entries(counts.byType).sort((a,b) => b[1]-a[1]).map(([t, n]) => (
            <option key={t} value={t === '(untyped)' ? '' : t}>{VIDEO_TYPE_STYLE[t]?.label ?? t} · {n}</option>
          ))}
        </select>
        <select value={contentClassFilter} onChange={(e) => setContentClassFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 11, border: '1px solid ' + HAIR, borderRadius: 3, color: INK, background: WHITE }}>
          <option value="">All classes</option>
          {Object.entries(counts.byClass).sort((a,b) => b[1]-a[1]).map(([c, n]) => (
            <option key={c} value={c === '(unclassified)' ? '' : c}>{CONTENT_CLASS_LABEL[c] ?? c} · {n}</option>
          ))}
        </select>
        <button
          onClick={() => setNeedsReviewOnly((v) => !v)}
          style={{
            padding: '4px 10px', fontSize: 11, borderRadius: 12, cursor: 'pointer',
            border: '1px solid ' + (needsReviewOnly ? RED : HAIR),
            background: needsReviewOnly ? RED : WHITE,
            color: needsReviewOnly ? WHITE : INK, fontWeight: needsReviewOnly ? 600 : 400,
          }}
        >Needs review · {counts.flagged}</button>
      </div>

      {msg && (
        <div style={{ padding: '6px 10px', background: '#F7F0E1', border: '1px solid ' + HAIR, borderRadius: 4, marginBottom: 10, fontSize: 12, color: INK }}>
          {msg}
          <button onClick={() => setMsg(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: INK_M }}>x</button>
        </div>
      )}

      {/* Grid */}
      {sorted.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: INK_M, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4 }}>
          No clips match this filter.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {sorted.map((v) => {
            const typeStyle = VIDEO_TYPE_STYLE[v.video_type ?? ''] ?? { bg: HAIR, fg: INK_M, label: v.video_type ?? '—' };
            return (
              <div key={v.asset_id} style={{
                background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4,
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}>
                <div
                  onClick={() => v.playable_path ? setSelected(v) : undefined}
                  style={{ position: 'relative', aspectRatio: '16/9', minHeight: 140, background: CREAM, cursor: v.playable_path ? 'pointer' : 'default' }}
                >
                  {v.poster_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.poster_path} alt={v.original_filename ?? ''} loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexDirection: 'column', gap: 4, color: INK_M, fontSize: 10,
                    }}>
                      <div style={{ fontSize: 32, opacity: 0.35 }}>▶</div>
                      <div>poster pending</div>
                    </div>
                  )}
                  {/* Duration + play chevron */}
                  <div style={{
                    position: 'absolute', right: 4, bottom: 4,
                    background: 'rgba(0,0,0,0.7)', color: WHITE, fontSize: 10, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 3, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatDuration(v.duration_sec)}{v.has_audio === false ? ' · muted' : ''}
                  </div>
                  {/* Video type chip */}
                  {v.video_type && (
                    <div style={{
                      position: 'absolute', left: 4, top: 4,
                      background: typeStyle.bg, color: typeStyle.fg, fontSize: 10, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 3, letterSpacing: '0.02em',
                    }}>{typeStyle.label}</div>
                  )}
                  {/* Needs-review flag */}
                  {v.needs_review && (
                    <div style={{
                      position: 'absolute', right: 4, top: 4,
                      background: RED, color: WHITE, fontSize: 10, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 3,
                    }}>⚠ review</div>
                  )}
                  {/* Usability bar */}
                  {v.usability_score != null && (
                    <div style={{
                      position: 'absolute', left: 0, right: 0, bottom: 0,
                      height: 3, background: HAIR,
                    }}>
                      <div style={{
                        width: Math.max(0, Math.min(100, v.usability_score)) + '%',
                        height: '100%', background: usabilityColor(v.usability_score),
                      }} />
                    </div>
                  )}
                </div>

                <div style={{ padding: '6px 8px', fontSize: 10, color: INK, borderTop: '1px solid ' + HAIR, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div title={v.original_filename ?? ''} style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.original_filename ?? v.asset_id.slice(0, 8)}
                  </div>
                  {v.caption && (
                    <div style={{ color: INK_M, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {v.caption}
                    </div>
                  )}
                  <div style={{ color: INK_M, display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
                    {v.category && <span>{v.category}</span>}
                    {v.usability_score != null && <span>· QI {v.usability_score}</span>}
                  </div>

                  {/* Inline area dropdown — only for hotel-class clips without area */}
                  {v.content_class === 'hotel' && !v.room_type_id && !v.facility_id && !v.activity_id && taxonomyGroups.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <select
                        aria-label="Assign area"
                        disabled={busyId === v.asset_id}
                        defaultValue=""
                        onChange={(e) => {
                          const [kind, key] = e.target.value.split('::');
                          if (!kind) return;
                          const tr = areaTaxonomy.find((t) => t.kind === kind && t.area_key === key);
                          if (tr) inlineAssign(v, tr);
                          e.currentTarget.value = '';
                        }}
                        style={{
                          width: '100%', fontSize: 10, padding: '4px 6px',
                          border: '1px solid ' + HAIR, background: WHITE, color: INK,
                          borderRadius: 3, cursor: busyId === v.asset_id ? 'wait' : 'pointer',
                        }}
                      >
                        <option value="">— assign area…</option>
                        {taxonomyGroups.map((g) => (
                          <optgroup key={g.kind} label={g.label}>
                            {g.rows.map((tr) => (
                              <option key={g.kind + '::' + tr.area_key} value={g.kind + '::' + tr.area_key}>
                                {tr.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Inline actions */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button
                      onClick={() => clearFlag(v.asset_id)}
                      disabled={busyId === v.asset_id}
                      title="Keep · clear review flag"
                      style={{ flex: 1, padding: '4px 6px', fontSize: 10, fontWeight: 600, background: WHITE, color: FOREST, border: '1px solid ' + FOREST, borderRadius: 3, cursor: busyId === v.asset_id ? 'wait' : 'pointer' }}
                    >Keep</button>
                    <button
                      onClick={() => archiveAsset(v.asset_id)}
                      disabled={busyId === v.asset_id}
                      title="Archive · demote tier, out of active library"
                      style={{ flex: 1, padding: '4px 6px', fontSize: 10, fontWeight: 600, background: WHITE, color: AMBER, border: '1px solid ' + AMBER, borderRadius: 3, cursor: busyId === v.asset_id ? 'wait' : 'pointer' }}
                    >Archive</button>
                    <button
                      onClick={() => deleteAsset(v.asset_id, v.original_filename)}
                      disabled={busyId === v.asset_id}
                      title="Delete · confirm junk (soft-delete, reversible)"
                      style={{ flex: 1, padding: '4px 6px', fontSize: 10, fontWeight: 600, background: WHITE, color: RED, border: '1px solid ' + RED, borderRadius: 3, cursor: busyId === v.asset_id ? 'wait' : 'pointer' }}
                    >Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer player */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(680px, 100%)', height: '100vh', background: WHITE, borderLeft: '1px solid ' + HAIR, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
                {selected.original_filename ?? selected.asset_id.slice(0, 8)}
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: INK_M, lineHeight: 1 }}>×</button>
            </div>

            {selected.playable_path ? (
              /* eslint-disable-next-line jsx-a11y/media-has-caption */
              <video src={selected.playable_path} controls poster={selected.poster_path ?? undefined} style={{ width: '100%', maxHeight: 420, background: '#000', borderRadius: 4 }} />
            ) : (
              <div style={{ padding: 40, background: CREAM, borderRadius: 4, textAlign: 'center', color: INK_M, fontSize: 12 }}>
                Inline playback not available yet — Cloudinary transcode pending. Card action buttons still work.
              </div>
            )}

            <div style={{ background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
              <FieldRow label="Type"          value={VIDEO_TYPE_STYLE[selected.video_type ?? '']?.label ?? (selected.video_type ?? '—')} />
              <FieldRow label="Content class" value={selected.content_class ?? '—'} />
              <FieldRow label="Category"      value={selected.category ?? '—'} />
              <FieldRow label="Sub-category"  value={selected.sub_category ?? '—'} />
              <FieldRow label="Duration"      value={formatDuration(selected.duration_sec)} />
              <FieldRow label="Dimensions"    value={selected.width_px && selected.height_px ? selected.width_px + '×' + selected.height_px : '—'} />
              <FieldRow label="Audio"         value={selected.has_audio == null ? '—' : (selected.has_audio ? 'yes' : 'muted')} />
              <FieldRow label="Usability"     value={selected.usability_score != null ? selected.usability_score + '%' : '—'} />
              <FieldRow label="Review flag"   value={selected.needs_review ? (selected.review_reason ?? 'flagged') : 'clean'} strong={selected.needs_review === true} />
              <FieldRow label="Analyzed"      value={selected.analyzed_at ? new Date(selected.analyzed_at).toLocaleString() : 'pending'} />
            </div>

            {selected.caption && (
              <div style={{ fontSize: 12, color: INK, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 10 }}>
                {selected.caption}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
              <button
                onClick={() => clearFlag(selected.asset_id)}
                disabled={busyId === selected.asset_id}
                style={{ flex: 1, padding: '12px 16px', fontSize: 13, fontWeight: 700, background: FOREST, color: WHITE, border: 'none', borderRadius: 4, cursor: busyId === selected.asset_id ? 'not-allowed' : 'pointer', opacity: busyId === selected.asset_id ? 0.6 : 1 }}
              >Keep</button>
              <button
                onClick={() => archiveAsset(selected.asset_id)}
                disabled={busyId === selected.asset_id}
                style={{ flex: 1, padding: '12px 16px', fontSize: 13, fontWeight: 700, background: WHITE, color: AMBER, border: '1px solid ' + AMBER, borderRadius: 4, cursor: busyId === selected.asset_id ? 'not-allowed' : 'pointer', opacity: busyId === selected.asset_id ? 0.6 : 1 }}
              >Archive</button>
              <button
                onClick={() => deleteAsset(selected.asset_id, selected.original_filename)}
                disabled={busyId === selected.asset_id}
                style={{ flex: 1, padding: '12px 16px', fontSize: 13, fontWeight: 700, background: WHITE, color: RED, border: '1px solid ' + RED, borderRadius: 4, cursor: busyId === selected.asset_id ? 'not-allowed' : 'pointer', opacity: busyId === selected.asset_id ? 0.6 : 1 }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: INK, fontWeight: strong ? 700 : 500, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}