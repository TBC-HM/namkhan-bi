// app/marketing/media/_client/VideoClarifyTab.tsx
// PBS 2026-07-12 · Task #148 — original mediaPage-based clarify.
// PBS 2026-07-29 · media-video-frontend brief · WORK ITEM 2 (A2) — REWRITTEN to
// the brief's data contract: fast list over public.v_media_videos rows with
// content_class='hotel' and NO area (room_type_id / facility_id / activity_id /
// destination_id all null). Row = poster (placeholder until Cloudinary runs) +
// Gemini/filename-suggested area + area dropdown from v_media_area_taxonomy
// (incl. destination folders) + confirm via /api/marketing/media/clarify-assign
// (public.fn_assign_area · fn_place_destination · bulk fn_bulk_clarify).
// Header: "Iris/Gemini suggests · Lens confirms".
'use client';

import { useMemo, useState } from 'react';
import type { VideoRow, AreaTaxonomyRow } from './VideoTriageTab';

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

const KIND_LABEL: Record<string, string> = {
  rooms: 'Rooms', facilities: 'Facilities', activities: 'Activities',
  certifications: 'Certifications', team: 'Team', destination: 'Destination',
  jungle_spa: 'Jungle Spa', fnb: 'F&B', transport: 'Transport',
  imekong: 'iMekong', retreats: 'Retreats', other: 'Other',
};

function hasArea(v: VideoRow): boolean {
  return v.room_type_id != null || v.facility_id != null || v.activity_id != null || v.destination_id != null;
}

// Suggestion source: Gemini notes when analysis has run, else the filename
// classification (category / sub_category) that already exists on 121 clips.
function suggestionFor(v: VideoRow): string | null {
  const n = v.ai_video_notes;
  const fromAi = n && typeof n === 'object' ? (n.suggested_area ?? n.area_suggestion ?? null) : null;
  if (typeof fromAi === 'string' && fromAi.trim()) return fromAi.trim();
  const parts = [v.category, v.sub_category].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export default function VideoClarifyTab({ videos, areaTaxonomy }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [localDismiss, setLocalDismiss] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<string>('');

  const queue = useMemo(
    () => videos.filter((v) => v.content_class === 'hotel' && !hasArea(v) && !localDismiss.has(v.asset_id)),
    [videos, localDismiss],
  );

  const taxonomyGroups = useMemo(() => {
    const byKind = new Map<string, AreaTaxonomyRow[]>();
    for (const r of areaTaxonomy) {
      if (!byKind.has(r.kind)) byKind.set(r.kind, []);
      byKind.get(r.kind)!.push(r);
    }
    const order = ['rooms', 'facilities', 'activities', 'jungle_spa', 'fnb', 'transport', 'imekong', 'retreats', 'certifications', 'team', 'destination', 'other'];
    const groups: Array<{ kind: string; label: string; rows: AreaTaxonomyRow[] }> = [];
    const seen = new Set<string>();
    for (const k of order) {
      const rows = byKind.get(k);
      if (rows && rows.length) { groups.push({ kind: k, label: KIND_LABEL[k] ?? k, rows }); seen.add(k); }
    }
    for (const [k, rows] of byKind) {
      if (!seen.has(k) && k !== 'uncategorized' && rows.length) groups.push({ kind: k, label: KIND_LABEL[k] ?? k, rows });
    }
    return groups;
  }, [areaTaxonomy]);

  function findTaxRow(value: string): AreaTaxonomyRow | null {
    const [kind, key] = value.split('::');
    if (!kind || !key) return null;
    return areaTaxonomy.find((t) => t.kind === kind && t.area_key === key) ?? null;
  }

  async function assignOne(v: VideoRow, taxRow: AreaTaxonomyRow) {
    setBusyId(v.asset_id); setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        asset_id: v.asset_id,
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
      setLocalDismiss((s) => new Set(s).add(v.asset_id));
      setChecked((s) => { const n = new Set(s); n.delete(v.asset_id); return n; });
      setMsg('Filed to ' + taxRow.name);
    } catch (e: any) { setMsg('Assign failed: ' + e.message); }
    finally { setBusyId(null); }
  }

  async function bulkAssign() {
    const taxRow = findTaxRow(bulkTarget);
    if (!taxRow || checked.size === 0) return;
    setBulkBusy(true); setMsg(null);
    const ids = Array.from(checked);
    try {
      if (taxRow.kind === 'destination') {
        // fn_place_destination is per-asset — loop the single endpoint.
        for (const id of ids) {
          const res = await fetch('/api/marketing/media/clarify-assign', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asset_id: id, kind: 'destination', ref_id: taxRow.ref_id ?? taxRow.area_key, area_key: taxRow.area_key }),
          });
          const j = await res.json();
          if (!res.ok || !j?.ok) throw new Error(j?.error || 'place_failed');
        }
      } else {
        // public.fn_bulk_clarify via the bulk path.
        const res = await fetch('/api/marketing/media/clarify-assign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_ids: ids, kind: taxRow.kind, ref_id: taxRow.ref_id, area_key: taxRow.area_key }),
        });
        const j = await res.json();
        if (!res.ok || !j?.ok) throw new Error(j?.error || 'bulk_failed');
      }
      setLocalDismiss((s) => { const n = new Set(s); ids.forEach((id) => n.add(id)); return n; });
      setChecked(new Set());
      setBulkTarget('');
      setMsg(ids.length + ' clips filed to ' + taxRow.name);
    } catch (e: any) { setMsg('Bulk assign failed: ' + e.message); }
    finally { setBulkBusy(false); }
  }

  function toggle(id: string) {
    setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const allChecked = queue.length > 0 && queue.every((v) => checked.has(v.asset_id));

  return (
    <div>
      {/* A2 header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Video Clarify — Iris/Gemini suggests · Lens confirms</div>
          <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>
            Hotel clips with no area yet. Confirm the suggested area or pick one — the clip files itself into the right folder.
          </div>
        </div>
        <div style={{ fontSize: 11, color: INK_M }}>{queue.length.toLocaleString()} to clarify</div>
      </div>

      {msg && (
        <div style={{ padding: '6px 10px', background: '#F7F0E1', border: '1px solid ' + HAIR, borderRadius: 4, marginBottom: 10, fontSize: 12, color: INK }}>
          {msg}
          <button onClick={() => setMsg(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: INK_M }}>x</button>
        </div>
      )}

      {/* Bulk bar */}
      {queue.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4, padding: '8px 10px' }}>
          <label style={{ fontSize: 11, color: INK, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allChecked}
              onChange={() => setChecked(allChecked ? new Set() : new Set(queue.map((v) => v.asset_id)))}
            />
            Select all ({checked.size} selected)
          </label>
          <select
            value={bulkTarget}
            onChange={(e) => setBulkTarget(e.target.value)}
            disabled={bulkBusy}
            style={{ padding: '5px 8px', fontSize: 11, border: '1px solid ' + HAIR, borderRadius: 3, color: INK, background: WHITE }}
          >
            <option value="">Bulk file to…</option>
            {taxonomyGroups.map((g) => (
              <optgroup key={g.kind} label={g.label}>
                {g.rows.map((tr) => (
                  <option key={g.kind + '::' + tr.area_key} value={g.kind + '::' + tr.area_key}>{tr.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={bulkAssign}
            disabled={bulkBusy || checked.size === 0 || !bulkTarget}
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 3,
              background: checked.size > 0 && bulkTarget ? FOREST : HAIR,
              color: checked.size > 0 && bulkTarget ? WHITE : INK_M,
              border: 'none', cursor: bulkBusy ? 'wait' : 'pointer',
            }}
          >{bulkBusy ? 'Filing…' : 'File selected'}</button>
        </div>
      )}

      {queue.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: INK_M, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, fontSize: 12 }}>
          Every hotel clip has an area. ✓
        </div>
      ) : (
        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, overflow: 'hidden' }}>
          {queue.map((v, i) => {
            const sugg = suggestionFor(v);
            return (
              <div key={v.asset_id} style={{
                display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px',
                borderTop: i === 0 ? 'none' : '1px solid ' + HAIR,
              }}>
                <input type="checkbox" checked={checked.has(v.asset_id)} onChange={() => toggle(v.asset_id)} />
                <div style={{ position: 'relative', width: 96, minWidth: 96, aspectRatio: '16/9', background: CREAM, borderRadius: 3, overflow: 'hidden' }}>
                  {v.poster_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.poster_path} alt={v.original_filename ?? ''} loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK_M, fontSize: 14, opacity: 0.4 }}>▶</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div title={v.original_filename ?? ''} style={{ fontSize: 11, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.original_filename ?? v.asset_id.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 10, color: sugg ? AMBER : INK_M, marginTop: 2 }}>
                    {sugg ? 'Suggests: ' + sugg : 'No suggestion — pick an area'}
                  </div>
                </div>
                <select
                  aria-label="Assign area"
                  disabled={busyId === v.asset_id || bulkBusy}
                  defaultValue=""
                  onChange={(e) => {
                    const tr = findTaxRow(e.target.value);
                    if (tr) assignOne(v, tr);
                    e.currentTarget.value = '';
                  }}
                  style={{
                    width: 200, fontSize: 10, padding: '5px 6px', border: '1px solid ' + HAIR,
                    background: WHITE, color: INK, borderRadius: 3,
                    cursor: busyId === v.asset_id ? 'wait' : 'pointer',
                  }}
                >
                  <option value="">— confirm area…</option>
                  {taxonomyGroups.map((g) => (
                    <optgroup key={g.kind} label={g.label}>
                      {g.rows.map((tr) => (
                        <option key={g.kind + '::' + tr.area_key} value={g.kind + '::' + tr.area_key}>{tr.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {queue.length > 0 && (
        <div style={{ fontSize: 10, color: INK_M, marginTop: 8 }}>
          Confirm writes via public.fn_assign_area / fn_place_destination · bulk via fn_bulk_clarify.
          {' '}Flagged junk? Use the <strong style={{ color: RED }}>Review</strong> sub-tab.
        </div>
      )}
    </div>
  );
}
