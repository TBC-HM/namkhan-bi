// app/marketing/media/_client/AiStudioTab.tsx
// PBS 2026-07-12 — AI Studio.
// 2026-07-11 pm: added required Category dropdown (media.ai_prompt_categories) — user picks a category first,
// its base_prompt is auto-prepended server-side. Placeholder + collapsed style-guidance preview from the row.
// Also: banner now shows failure `reason` from the server so PBS sees the real error (billing / bucket / etc.).
// 2026-07-12 pm: added Room / Facility grounding dropdown driven by category.requires_context.
//   When category requires 'room' → Room picker (from v_room_grounding). When 'facility' → Facility picker
//   (from v_facility_grounding, grouped by category). Both required to submit. The chosen id is sent to the
//   edge fn which injects the SPECIFIC ROOM / SPECIFIC FACILITY block into the effective_prompt so the
//   engine never has to guess resort-specific details.
'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';

interface AiGen {
  id: string; property_id: number; mode: string; source_asset_id: string | null;
  prompt: string; effective_prompt: string | null; engine: string;
  target_tier: string; candidate_paths: string[] | null; chosen_asset_id: string | null;
  reality_check: string | null; reality_reason: string | null;
  cost_eur: number | null; cost_cap_eur: number | null;
  status: string; created_by: string | null; created_at: string;
  finished_at?: string | null; category_key?: string | null;
  room_type_id?: number | null; facility_id?: number | null;
}

interface MediaRow {
  asset_id: string;
  original_filename: string;
  primary_tier: string | null;
  public_url: string | null;
  master_path: string | null;
  mime_type: string | null;
  width_px: number | null;
  height_px: number | null;
}

export interface PromptCategory {
  key: string;
  display_name: string;
  property_id: number | null;
  base_prompt: string;
  default_target_tier: string;
  example_hint: string | null;
  active: boolean;
  sort_order: number;
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
}

interface Props {
  propertyId: number;
  mediaPage: MediaRow[];
  aiGens: AiGen[];
  initialSourceAssetId?: string | null;
  categories: PromptCategory[];
  rooms: RoomOption[];
  facilities: FacilityOption[];
}

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#1F3A2E';
const RED    = '#B03826';
const WHITE  = '#FFFFFF';

// PBS 2026-07-11 pm: bucket media-ai is public — CDN URL for candidate thumbnails.
const MEDIA_AI_PUBLIC = 'https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/media-ai/';

const TIERS = [
  { key: 'tier_social_pool', label: 'Social pool' },
  { key: 'tier_internal',    label: 'Internal only' },
];

export default function AiStudioTab({ propertyId, mediaPage, aiGens, initialSourceAssetId, categories, rooms, facilities }: Props) {
  const [mode, setMode] = useState<'prompt' | 'from_asset'>(initialSourceAssetId ? 'from_asset' : 'prompt');
  const [prompt, setPrompt] = useState('');
  const [tier, setTier] = useState('tier_social_pool');
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(initialSourceAssetId ?? null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok'|'err'|'warn'; text: string } | null>(null);
  const [rows, setRows] = useState<AiGen[]>(aiGens);
  const [polling, setPolling] = useState<string | null>(null);

  // Picker state
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string | null>(null);

  // Category state
  const activeCategories = useMemo(
    () => (categories ?? [])
      .filter(c => c.active !== false)
      .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100) || a.display_name.localeCompare(b.display_name)),
    [categories]
  );
  const [categoryKey, setCategoryKey] = useState<string>('');
  const [styleExpanded, setStyleExpanded] = useState(false);
  const selectedCategory = activeCategories.find(c => c.key === categoryKey) ?? null;
  const needsRoom     = selectedCategory?.requires_context === 'room';
  const needsFacility = selectedCategory?.requires_context === 'facility';

  // Grounding state
  const [roomTypeId, setRoomTypeId] = useState<number | ''>('');
  const [facilityId, setFacilityId] = useState<number | ''>('');

  const selectedRoom     = useMemo(() => (rooms ?? []).find(r => r.room_type_id === Number(roomTypeId)) ?? null, [rooms, roomTypeId]);
  const selectedFacility = useMemo(() => (facilities ?? []).find(f => f.facility_id === Number(facilityId)) ?? null, [facilities, facilityId]);

  // Group facilities by their content-category for the <optgroup>.
  const facilitiesByCategory = useMemo(() => {
    const grouped: Record<string, FacilityOption[]> = {};
    for (const f of (facilities ?? [])) {
      const cat = f.category || 'other';
      (grouped[cat] ??= []).push(f);
    }
    return grouped;
  }, [facilities]);

  useEffect(() => { setRows(aiGens); }, [aiGens]);

  useEffect(() => {
    if (initialSourceAssetId) {
      setSourceAssetId(initialSourceAssetId);
      setMode('from_asset');
    }
  }, [initialSourceAssetId]);

  // When category changes, snap tier to that category's default (if allowed) and clear stale grounding.
  useEffect(() => {
    if (selectedCategory && (selectedCategory.default_target_tier === 'tier_social_pool' || selectedCategory.default_target_tier === 'tier_internal')) {
      setTier(selectedCategory.default_target_tier);
    }
    if (!needsRoom)     setRoomTypeId('');
    if (!needsFacility) setFacilityId('');
  }, [categoryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const photos = useMemo(() => {
    return (mediaPage ?? []).filter(m => {
      const mt = (m.mime_type ?? '').toLowerCase();
      return mt === '' || mt.startsWith('image/');
    });
  }, [mediaPage]);

  const distinctTiers = useMemo(() => {
    const s = new Set<string>();
    for (const p of photos) if (p.primary_tier) s.add(p.primary_tier);
    return Array.from(s).sort();
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return photos.filter(p => {
      if (tierFilter && p.primary_tier !== tierFilter) return false;
      if (q && !(p.original_filename ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [photos, search, tierFilter]);

  const selectedRow = sourceAssetId ? photos.find(p => p.asset_id === sourceAssetId) : null;

  async function refreshRow(id: string) {
    try {
      const res = await fetch(`/api/marketing/media/ai-generate?id=${encodeURIComponent(id)}`);
      const j = await res.json();
      if (res.ok && j.row) {
        setRows(prev => {
          const exists = prev.some(r => r.id === id);
          return exists ? prev.map(r => r.id === id ? j.row : r) : [j.row, ...prev];
        });
        if (j.row.status === 'review' || j.row.status === 'completed' || j.row.status === 'failed' || j.row.status === 'rejected') {
          setPolling(null);
          if (j.row.status === 'failed' || j.row.status === 'rejected') {
            setBanner({ tone:'err', text:`Generation ${j.row.status}: ${j.row.reality_reason ?? '(no reason recorded)'}` });
          }
        }
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => refreshRow(polling), 5000);
    return () => clearInterval(t);
  }, [polling]);

  const canSubmit =
    !!categoryKey &&
    prompt.trim().length > 0 &&
    (mode === 'prompt' || !!sourceAssetId) &&
    (!needsRoom     || !!roomTypeId) &&
    (!needsFacility || !!facilityId);

  async function submit() {
    setBanner(null);
    if (!categoryKey) { setBanner({ tone:'warn', text:'Pick a category first.' }); return; }
    if (needsRoom     && !roomTypeId) { setBanner({ tone:'warn', text:'This category needs a room. Pick one.' }); return; }
    if (needsFacility && !facilityId) { setBanner({ tone:'warn', text:'This category needs a facility. Pick one.' }); return; }
    if (!prompt.trim()) { setBanner({ tone:'warn', text:'Add a prompt describing what you want.' }); return; }
    if (mode === 'from_asset' && !sourceAssetId) { setBanner({ tone:'warn', text:'Pick a photo first.' }); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/marketing/media/ai-generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          mode,
          prompt,
          target_tier: tier,
          source_asset_id: mode === 'from_asset' ? sourceAssetId : null,
          category_key: categoryKey,
          room_type_id: needsRoom     ? Number(roomTypeId) : null,
          facility_id:  needsFacility ? Number(facilityId)  : null,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        const errKey = String(j.error ?? '');
        const reason = j.reason ?? '';
        if (errKey === 'openai_key_missing_in_vault' || /openai.*missing/i.test(errKey)) {
          setBanner({ tone:'err', text:'OpenAI key not configured — ask PBS to add OPENAI_IMAGE_KEY to Supabase vault.' });
        } else {
          setBanner({ tone:'err', text:`Failed (${errKey || res.statusText})${reason ? `: ${reason}` : ''}` });
        }
        if (j.generation_id) { setPolling(null); refreshRow(j.generation_id); }
        return;
      }
      setBanner({ tone:'ok', text:`Queued generation ${j.generation_id ?? j.id ?? ''}. Polling…` });
      const newId = j.generation_id ?? j.id;
      if (newId) { setPolling(newId); refreshRow(newId); }
      setPrompt('');
    } catch (e: any) {
      setBanner({ tone:'err', text:`Failed: ${e.message}` });
    } finally { setBusy(false); }
  }

  async function accept(genId: string, candidatePath: string) {
    try {
      const res = await fetch('/api/marketing/media/ai-accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generation_id: genId, candidate_path: candidatePath }),
      });
      const j = await res.json();
      if (!res.ok) { setBanner({ tone:'err', text:`Accept failed: ${j.error ?? res.statusText}` }); return; }
      setBanner({ tone:'ok', text:`Accepted → media library asset ${j.asset_id}.` });
      refreshRow(genId);
    } catch (e: any) { setBanner({ tone:'err', text:`Accept failed: ${e.message}` }); }
  }

  const bannerBg = banner?.tone === 'ok' ? '#EAF3EA' : banner?.tone === 'err' ? '#FBE9E7' : '#F7F0E1';
  const bannerFg = banner?.tone === 'ok' ? FOREST : banner?.tone === 'err' ? RED : INK;

  const placeholder = selectedCategory?.example_hint
    ? selectedCategory.example_hint
    : (mode === 'from_asset'
        ? 'e.g. Keep the villa architecture; recompose at golden hour with mist rising off the river'
        : 'e.g. Namkhan river bend at golden hour, teak villa in the foreground, misty jungle canopy behind');

  return (
    <div>
      {banner && (
        <div style={{ padding:'10px 14px', background:bannerBg, color:bannerFg, border:'1px solid '+HAIR, borderRadius:4, marginBottom:12, fontSize:12, whiteSpace:'pre-wrap' }}>
          {banner.text} <button onClick={() => setBanner(null)} style={{ marginLeft:8, background:'none', border:'none', cursor:'pointer', color:INK_M }}>×</button>
        </div>
      )}

      <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:16, marginBottom:16 }}>

        {/* Category dropdown — REQUIRED, at the top */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>
            Category <span style={{ color:RED }}>*</span>
          </label>
          {activeCategories.length === 0 ? (
            <div style={{ padding:10, fontSize:12, background:'#FBE9E7', color:RED, border:'1px solid '+HAIR, borderRadius:4 }}>
              No categories defined yet. Ask PBS to add one via Settings ⚙ → Prompt Categories.
            </div>
          ) : (
            <>
              <select
                value={categoryKey}
                onChange={e => setCategoryKey(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK }}
              >
                <option value="">— pick a category —</option>
                {activeCategories.map(c => (
                  <option key={c.key} value={c.key}>
                    {c.display_name}{c.property_id === null ? ' (global)' : ''}{c.requires_context === 'room' ? ' · needs room' : c.requires_context === 'facility' ? ' · needs facility' : ''}
                  </option>
                ))}
              </select>
              {selectedCategory && (
                <div style={{ marginTop:8, border:'1px dashed '+HAIR, borderRadius:4, padding:'8px 10px', background:'#FAF6EC' }}>
                  <button
                    onClick={() => setStyleExpanded(v => !v)}
                    style={{ background:'none', border:'none', padding:0, cursor:'pointer', color:INK_M, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600 }}
                  >
                    {styleExpanded ? '▾' : '▸'} Style guidance (auto-prepended)
                  </button>
                  {styleExpanded && (
                    <div style={{ marginTop:6, fontSize:12, color:INK, fontStyle:'italic', lineHeight:1.5, whiteSpace:'pre-wrap' }}>
                      {selectedCategory.base_prompt}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Room grounding — appears when category requires it */}
        {needsRoom && (
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>
              Room <span style={{ color:RED }}>*</span>
              <span style={{ marginLeft:6, color:INK_M, fontWeight:400, textTransform:'none', letterSpacing:0 }}>
                — from PMS ({rooms.length} types)
              </span>
            </label>
            <select
              value={roomTypeId === '' ? '' : String(roomTypeId)}
              onChange={e => setRoomTypeId(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK }}
            >
              <option value="">— pick a room type —</option>
              {rooms.map(r => (
                <option key={r.room_type_id} value={r.room_type_id}>
                  {r.room_type_name}{r.max_guests ? ` · sleeps ${r.max_guests}` : ''}{r.units ? ` · ${r.units} units` : ''}
                </option>
              ))}
            </select>
            {selectedRoom && (
              <div style={{ marginTop:6, fontSize:11, color:INK_M, padding:'6px 8px', background:'#FAF6EC', border:'1px dashed '+HAIR, borderRadius:4 }}>
                <strong>{selectedRoom.room_type_name}</strong>
                {selectedRoom.amenities_count ? ` · ${selectedRoom.amenities_count} amenities` : ''}
                {selectedRoom.description_clean ? ` · ${selectedRoom.description_clean.slice(0, 140)}${selectedRoom.description_clean.length > 140 ? '…' : ''}` : ''}
              </div>
            )}
          </div>
        )}

        {/* Facility grounding — appears when category requires it */}
        {needsFacility && (
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>
              Facility <span style={{ color:RED }}>*</span>
              <span style={{ marginLeft:6, color:INK_M, fontWeight:400, textTransform:'none', letterSpacing:0 }}>
                — {facilities.length} on-property
              </span>
            </label>
            <select
              value={facilityId === '' ? '' : String(facilityId)}
              onChange={e => setFacilityId(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK }}
            >
              <option value="">— pick a facility —</option>
              {Object.entries(facilitiesByCategory).sort(([a],[b]) => a.localeCompare(b)).map(([cat, list]) => (
                <optgroup key={cat} label={cat.toUpperCase()}>
                  {list.map(f => (
                    <option key={f.facility_id} value={f.facility_id}>
                      {f.facility_name}{f.ai_description == null ? ' · (no AI enrichment)' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedFacility && (
              <div style={{ marginTop:6, fontSize:11, color:INK_M, padding:'6px 8px', background:'#FAF6EC', border:'1px dashed '+HAIR, borderRadius:4 }}>
                <strong>{selectedFacility.facility_name}</strong>
                {selectedFacility.category ? ` · ${selectedFacility.category}` : ''}
                {selectedFacility.time_of_day_hint ? ` · ${selectedFacility.time_of_day_hint}` : ''}
                {selectedFacility.ai_description ? ` · ${selectedFacility.ai_description.slice(0, 140)}${selectedFacility.ai_description.length > 140 ? '…' : ''}` : ' · (enrich this facility in Settings → Reality)'}
              </div>
            )}
          </div>
        )}

        {/* Mode toggle */}
        <div style={{ display:'flex', gap:12, marginBottom:12 }}>
          <button onClick={() => setMode('prompt')} style={{
            padding:'6px 12px', fontSize:12, fontWeight:600, borderRadius:4,
            border:'1px solid ' + (mode === 'prompt' ? FOREST : HAIR),
            background: mode === 'prompt' ? FOREST : WHITE, color: mode === 'prompt' ? WHITE : INK, cursor:'pointer',
          }}>from prompt</button>
          <button onClick={() => setMode('from_asset')} style={{
            padding:'6px 12px', fontSize:12, fontWeight:600, borderRadius:4,
            border:'1px solid ' + (mode === 'from_asset' ? FOREST : HAIR),
            background: mode === 'from_asset' ? FOREST : WHITE, color: mode === 'from_asset' ? WHITE : INK, cursor:'pointer',
          }}>from existing photo</button>
        </div>

        {mode === 'from_asset' && (
          <div style={{ marginBottom:14, border:'1px solid '+HAIR, borderRadius:6, padding:12, background:'#FAF6EC' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:8 }}>
              <span style={{ fontSize:11, color:INK_M, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600 }}>
                Pick a source photo · {filteredPhotos.length} of {photos.length}
              </span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search filename…"
                style={{ padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK, minWidth:200 }}
              />
            </div>

            {distinctTiers.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                <TierChip label="all" active={tierFilter === null} onClick={() => setTierFilter(null)} />
                {distinctTiers.map(t => (
                  <TierChip key={t} label={t} active={tierFilter === t} onClick={() => setTierFilter(t)} />
                ))}
              </div>
            )}

            {filteredPhotos.length === 0 ? (
              <div style={{ padding:20, textAlign:'center', color:INK_M, fontSize:12 }}>
                No photos match. Clear search / tier filter.
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:8, maxHeight:340, overflowY:'auto', padding:2 }}>
                {filteredPhotos.map(p => {
                  const url = p.public_url ?? null;
                  const selected = p.asset_id === sourceAssetId;
                  return (
                    <button
                      key={p.asset_id}
                      onClick={() => setSourceAssetId(selected ? null : p.asset_id)}
                      title={p.original_filename}
                      style={{
                        position:'relative', padding:0, border:'1px solid '+HAIR, borderRadius:4,
                        background: url ? '#000' : '#EEE', height:80, cursor:'pointer', overflow:'hidden',
                        boxShadow: selected ? '0 0 0 3px '+FOREST : 'none',
                        transition: 'box-shadow 120ms ease',
                      }}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={p.original_filename} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                      ) : (
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontSize:10, color:INK_M, padding:4, textAlign:'center' }}>
                          {p.original_filename?.slice(0, 40) ?? '(no url)'}
                        </div>
                      )}
                      {selected && (
                        <div style={{ position:'absolute', top:2, right:2, background:FOREST, color:WHITE, fontSize:9, padding:'2px 5px', borderRadius:2, fontWeight:600 }}>
                          selected
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedRow && (
              <div style={{ marginTop:10, fontSize:11, color:INK }}>
                Selected: <strong>{selectedRow.original_filename}</strong>
                {selectedRow.primary_tier && <span style={{ color:INK_M }}> · {selectedRow.primary_tier}</span>}
                {selectedRow.width_px && selectedRow.height_px && (
                  <span style={{ color:INK_M }}> · {selectedRow.width_px}×{selectedRow.height_px}</span>
                )}
                <button
                  onClick={() => setSourceAssetId(null)}
                  style={{ marginLeft:8, padding:'2px 8px', fontSize:10, background:WHITE, color:INK_M, border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer' }}
                >clear</button>
              </div>
            )}
          </div>
        )}

        <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Prompt</label>
        <textarea
          value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
          placeholder={placeholder}
          style={{ width:'100%', padding:10, fontSize:13, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK, resize:'vertical', marginBottom:12 }}
        />

        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12, marginBottom:12 }}>
          <div>
            <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Target tier</label>
            <select value={tier} onChange={e => setTier(e.target.value)} style={{
              width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK,
            }}>
              {TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <div style={{ fontSize:10, color:INK_M, marginTop:4 }}>Hero + OTA tiers are blocked from AI generation.</div>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <button
            onClick={submit}
            disabled={busy || !canSubmit}
            title={
              !categoryKey ? 'Pick a category first'
              : needsRoom && !roomTypeId ? 'Pick a room first'
              : needsFacility && !facilityId ? 'Pick a facility first'
              : (mode === 'from_asset' && !sourceAssetId ? 'Pick a photo first' : '')
            }
            style={{
              padding:'8px 16px', fontSize:12, fontWeight:600,
              background: canSubmit ? FOREST : '#B7C7BE',
              color:WHITE, border:'none', borderRadius:4,
              cursor: (busy || !canSubmit) ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >{busy ? 'Generating…' : 'Generate → auto'}</button>
          {!categoryKey && <span style={{ fontSize:11, color:RED }}>Pick a category first</span>}
          {categoryKey && needsRoom     && !roomTypeId && <span style={{ fontSize:11, color:RED }}>Pick a room</span>}
          {categoryKey && needsFacility && !facilityId && <span style={{ fontSize:11, color:RED }}>Pick a facility</span>}
          {categoryKey && mode === 'from_asset' && !sourceAssetId && (
            <span style={{ fontSize:11, color:RED }}>Pick a photo first</span>
          )}
        </div>
      </div>

      <div style={{ marginBottom:8, fontSize:11, color:INK_M, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>Recent generations · {rows.length}</div>
      {rows.length === 0 ? (
        <div style={{ padding:20, textAlign:'center', color:INK_M, background:WHITE, border:'1px solid '+HAIR, borderRadius:4, fontSize:12 }}>
          No generations yet.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.slice(0, 20).map(g => (
            <div key={g.id} style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:4, padding:12, fontSize:12, color:INK }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'baseline', flexWrap:'wrap' }}>
                <span style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis' }}>{g.prompt.slice(0, 80)}{g.prompt.length > 80 ? '…' : ''}</span>
                <span style={{ fontSize:10, color:INK_M }}>{new Date(g.created_at).toLocaleString()}</span>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:4, fontSize:10, color:INK_M, flexWrap:'wrap' }}>
                <span>mode: {g.mode}</span>
                <span>tier: {g.target_tier}</span>
                {g.category_key && <span>category: <strong>{g.category_key}</strong></span>}
                {g.room_type_id && <span>room: {g.room_type_id}</span>}
                {g.facility_id  && <span>facility: {g.facility_id}</span>}
                <span>engine: {g.engine}</span>
                <span>status: <strong style={{ color: (g.status === 'completed' || g.status === 'review') ? FOREST : g.status === 'failed' ? RED : INK }}>{g.status}</strong></span>
                {g.reality_check && <span>reality: {g.reality_check}</span>}
                {g.cost_eur != null && <span>cost: EUR {Number(g.cost_eur).toFixed(2)}</span>}
              </div>
              {(g.status === 'failed' || g.status === 'rejected') && g.reality_reason && (
                <div style={{ marginTop:6, padding:'6px 8px', background:'#FBE9E7', color:RED, fontSize:11, borderRadius:3, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                  <strong>reason:</strong> {g.reality_reason}
                </div>
              )}
              {g.candidate_paths && g.candidate_paths.length > 0 && !g.chosen_asset_id && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:10, marginTop:10 }}>
                  {g.candidate_paths.map((p, i) => (
                    <div key={g.id + '_' + i} style={{ border:'1px solid '+HAIR, borderRadius:4, overflow:'hidden', background:WHITE }}>
                      <a href={MEDIA_AI_PUBLIC + p} target="_blank" rel="noopener noreferrer" title="Open full-size in new tab" style={{ display:'block', aspectRatio:'1 / 1', background:'#F5F1E6' }}>
                        <img src={MEDIA_AI_PUBLIC + p} alt={'candidate '+(i+1)} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                      </a>
                      <div style={{ display:'flex', gap:4, padding:6, borderTop:'1px solid '+HAIR }}>
                        <button onClick={() => accept(g.id, p)} style={{
                          flex:1, padding:'6px 8px', fontSize:10, background:FOREST, color:WHITE, border:'none', borderRadius:3, cursor:'pointer', fontWeight:600,
                        }}>Accept #{i + 1}</button>
                        <a href={MEDIA_AI_PUBLIC + p} target="_blank" rel="noopener noreferrer" style={{
                          padding:'6px 10px', fontSize:10, background:WHITE, color:INK, border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer', textDecoration:'none', display:'inline-flex', alignItems:'center',
                        }} title="Open in new tab to download / edit externally">↗</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {g.chosen_asset_id && <div style={{ fontSize:10, color:FOREST, marginTop:4 }}>✓ accepted as asset {g.chosen_asset_id.slice(0, 8)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TierChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:'3px 10px', fontSize:10, borderRadius:12, cursor:'pointer',
        border:'1px solid '+(active ? FOREST : HAIR),
        background: active ? FOREST : WHITE,
        color: active ? WHITE : INK_M,
        fontWeight: active ? 600 : 500,
      }}
    >{label}</button>
  );
}
