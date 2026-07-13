// app/marketing/media/_client/AssetEditDrawer.tsx
// PBS 2026-07-12 — Reusable Edit ✎ drawer, mounted from LibraryTab + ClarifyTab.
// 2026-07-13 · Video meta section (duration/aspect/camera/audio/color/desc).
// 2026-07-13 pm · MEDIA QA v1 — collapsible "Quality Score" breakdown with
//   tech/aes/mkt bars, naming-convention check, detected-text flags, and
//   Re-score button that POSTs to /api/marketing/media/qa-rescore.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '@/app/(cockpit)/_design';
import VideoPlayerModal, { type VideoPlayerAsset } from './VideoPlayerModal';
import { qaBadge, qualityIndex } from '@/lib/mediaQa';

export interface RoomOption { room_type_id: number; room_type_name: string; }

export interface DrawerTaxonomy {
  rooms:          Array<{ id: number; name: string }>;
  facilities:     Array<{ id: number; name: string; parent_name?: string | null }>;
  activities:     Array<{ id: number; name: string; facility_name?: string | null }>;
  meeting_spaces: Array<{ id: number; name: string }>;
  transport:      Array<{ id: number; name: string; kind?: string | null; route_from?: string | null; route_to?: string | null }>;
  boats?:         Array<{ id: number; name: string }>;
  boat_cruises?:  Array<{ id: number; name: string; boat_name?: string | null }>;
}

export interface AssetEditRow {
  asset_id: string;
  room_type_id?: number | null;
  original_filename?: string | null;
  caption?: string | null;
  alt_text?: string | null;
  primary_tier?: string | null;
  property_area?: string | null;
  is_ai_generated?: boolean | null;
  public_url?: string | null;
  master_path?: string | null;
  mime_type?: string | null;
  status?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  file_size_bytes?: number | string | null;
  file_size_human?: string | null;
  created_at?: string | null;
  duration_sec?: number | null;
  aspect_ratio?: string | null;
  captured_at?: string | null;
  camera_make?: string | null;
  camera_model?: string | null;
  lens?: string | null;
  has_audio?: boolean | null;
  audio_type?: string | null;
  audio_language?: string | null;
  color_profile?: string | null;
  visual_description?: string | null;
  // Media QA v1
  technical_score?: number | null;
  aesthetic_score?: number | null;
  marketing_score?: number | null;
  quality_index?: number | null;
  qa_notes?: any;
  qa_model?: string | null;
  qa_scored_at?: string | null;
  detected_text?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  asset: AssetEditRow | null;
  areaOptions: string[];
  rooms?: RoomOption[];
  taxonomy?: DrawerTaxonomy;
  onSaved?: (updated: any) => void;
}

const TIERS: Array<{ key: string; label: string }> = [
  { key: 'tier_website_hero', label: 'Website hero' },
  { key: 'tier_ota_profile',  label: 'OTA profile'  },
  { key: 'tier_social_pool',  label: 'Social pool'  },
  { key: 'tier_internal',     label: 'Internal'     },
  { key: 'tier_logos',        label: 'Logos'        },
  { key: 'tier_archive',      label: 'Archive'      },
];

const AUDIO_TYPES: Array<{ key: string; label: string }> = [
  { key: '',          label: '(unset)'  },
  { key: 'none',      label: 'None'     },
  { key: 'dialog',    label: 'Dialog'   },
  { key: 'narration', label: 'Narration' },
  { key: 'music',     label: 'Music'    },
  { key: 'ambient',   label: 'Ambient'  },
  { key: 'mixed',     label: 'Mixed'    },
];

const COLOR_PROFILES: Array<{ key: string; label: string }> = [
  { key: '',       label: '(unset)' },
  { key: 'rec709', label: 'Rec.709' },
  { key: 'HLG',    label: 'HLG'     },
  { key: 'HDR10',  label: 'HDR10'   },
  { key: 'Log',    label: 'Log'     },
  { key: 'sRGB',   label: 'sRGB'    },
];

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST= '#084838';
const CREAM = '#F5F0E1';
const RED   = '#B23A2E';
const OK    = '#0E7A4B';

function isVideo(row: AssetEditRow | null): boolean {
  if (!row) return false;
  const mt = (row.mime_type ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  const path = (row.public_url ?? row.master_path ?? '').toLowerCase();
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test(path);
}

function humanSize(v: any): string {
  const n = Number(v ?? 0);
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDurMMSS(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(Number(sec))) return '';
  const s = Math.round(Number(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Small horizontal bar for QA score breakdown (0-100).
function QaBar({ value, label, detail }: { value: number | null | undefined; label: string; detail?: string }) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, Number(value)));
  const badge = qaBadge(value ?? null);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: INK, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color: INK_M, fontVariantNumeric: 'tabular-nums' }}>{value == null ? '—' : v}</span>
      </div>
      <div style={{ height: 4, background: HAIR, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: v + '%', height: '100%', background: badge.bg }} />
      </div>
      {detail && <div style={{ fontSize: 10, color: INK_M, marginTop: 4 }}>{detail}</div>}
    </div>
  );
}

export default function AssetEditDrawer({ open, onClose, asset, areaOptions, rooms = [], taxonomy, onSaved }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [filename, setFilename]   = useState('');
  const [caption, setCaption]     = useState('');
  const [altText, setAltText]     = useState('');
  const [tier, setTier]           = useState('');
  const [area, setArea]           = useState('');
  const [aiGen, setAiGen]         = useState(false);
  const [roomTypeId, setRoomTypeId] = useState<string>('');

  const [drawerPlaying, setDrawerPlaying] = useState(false);
  const [capturedAt, setCapturedAt] = useState('');
  const [cameraMake, setCameraMake] = useState('');
  const [cameraModel, setCameraModel] = useState('');
  const [lens, setLens] = useState('');
  const [hasAudio, setHasAudio] = useState(false);
  const [audioType, setAudioType] = useState('');
  const [audioLanguage, setAudioLanguage] = useState('');
  const [colorProfile, setColorProfile] = useState('');
  const [visualDescription, setVisualDescription] = useState('');

  // QA re-score state
  const [rescoring, setRescoring] = useState(false);
  const [rescoreMsg, setRescoreMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !asset) return;
    setErr(null); setOk(null); setRescoreMsg(null);
    setFilename(asset.original_filename ?? '');
    setCaption(asset.caption ?? '');
    setAltText(asset.alt_text ?? '');
    setTier(asset.primary_tier ?? '');
    setArea(asset.property_area ?? '');
    setAiGen(Boolean(asset.is_ai_generated));
    setRoomTypeId(asset.room_type_id != null ? String(asset.room_type_id) : '');
    setCapturedAt(asset.captured_at ? String(asset.captured_at).slice(0, 10) : '');
    setCameraMake(asset.camera_make ?? '');
    setCameraModel(asset.camera_model ?? '');
    setLens(asset.lens ?? '');
    setHasAudio(Boolean(asset.has_audio));
    setAudioType(asset.audio_type ?? '');
    setAudioLanguage(asset.audio_language ?? '');
    setColorProfile(asset.color_profile ?? '');
    setVisualDescription(asset.visual_description ?? '');
    setDrawerPlaying(false);
  }, [open, asset]);

  if (!asset) return null;

  const video = isVideo(asset);
  const size = asset.file_size_human || humanSize(asset.file_size_bytes);

  const qIndex = asset.quality_index ?? qualityIndex(asset.technical_score, asset.aesthetic_score, asset.marketing_score);
  const badge = qaBadge(qIndex);
  const notes = asset.qa_notes ?? null;
  const tech = notes?.technical ?? {};
  const aes  = notes?.aesthetic ?? {};
  const mkt  = notes?.marketing ?? {};
  const naming = notes?.naming_convention ?? null;
  const flags = notes?.detected_flags ?? null;

  async function save() {
    if (!asset) return;
    setSaving(true); setErr(null); setOk(null);
    try {
      const payload: any = { asset_id: asset.asset_id };
      if (filename !== (asset.original_filename ?? '')) payload.original_filename = filename;
      if (caption !== (asset.caption ?? ''))             payload.caption = caption;
      if (altText !== (asset.alt_text ?? ''))            payload.alt_text = altText;
      if (tier    !== (asset.primary_tier ?? ''))        payload.primary_tier = tier || null;
      if (area    !== (asset.property_area ?? ''))       payload.property_area = area || null;
      if (aiGen   !== Boolean(asset.is_ai_generated))    payload.is_ai_generated = aiGen;
      const currentRoom = asset.room_type_id != null ? String(asset.room_type_id) : '';
      if (roomTypeId !== currentRoom) payload.room_type_id = roomTypeId || null;

      if (video) {
        const curCapturedAt = asset.captured_at ? String(asset.captured_at).slice(0, 10) : '';
        if (capturedAt        !== curCapturedAt)                     payload.captured_at        = capturedAt || null;
        if (cameraMake        !== (asset.camera_make ?? ''))         payload.camera_make        = cameraMake;
        if (cameraModel       !== (asset.camera_model ?? ''))        payload.camera_model       = cameraModel;
        if (lens              !== (asset.lens ?? ''))                payload.lens               = lens;
        if (hasAudio          !== Boolean(asset.has_audio))          payload.has_audio          = hasAudio;
        if (audioType         !== (asset.audio_type ?? ''))          payload.audio_type         = audioType || null;
        if (audioLanguage     !== (asset.audio_language ?? ''))      payload.audio_language     = audioLanguage;
        if (colorProfile      !== (asset.color_profile ?? ''))       payload.color_profile      = colorProfile || null;
        if (visualDescription !== (asset.visual_description ?? ''))  payload.visual_description = visualDescription;
      }

      const res = await fetch('/api/marketing/media/asset-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'save_failed');

      setOk('Asset updated ✓');
      onSaved?.(j.asset);
      router.refresh();
      setTimeout(() => { onClose(); }, 700);
    } catch (e: any) {
      setErr(e.message ?? 'unknown');
    } finally {
      setSaving(false);
    }
  }

  async function rescore() {
    if (!asset) return;
    setRescoring(true); setRescoreMsg('Rescoring… (~40s per image)');
    try {
      const res = await fetch('/api/marketing/media/qa-rescore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: asset.asset_id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'rescore_failed');
      const r = j.result ?? {};
      setRescoreMsg(`Rescored ✓ · tech ${r.technical_score ?? '?'} · aes ${r.aesthetic_score ?? '?'} · mkt ${r.marketing_score ?? '?'} · quality ${r.quality_index ?? '?'}%`);
      router.refresh();
    } catch (e: any) {
      setRescoreMsg('Rescore failed: ' + e.message);
    } finally {
      setRescoring(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Edit asset"
      subtitle={asset.asset_id}
      width="md"
      footer={
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={S.btnGhost}>Cancel</button>
          <button onClick={save} disabled={saving} style={S.btnPrimary}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      }
    >
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {video && (
          <button
            type="button"
            onClick={() => setDrawerPlaying(true)}
            style={{
              display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px',
              background:FOREST, color:WHITE, border:'none', borderRadius:4,
              fontSize:12, fontWeight:600, cursor:'pointer', letterSpacing:'0.04em',
              textTransform:'uppercase', alignSelf:'flex-start',
            }}
          >▶ Play video</button>
        )}

        <div style={{ display:'flex', gap:12 }}>
          <div style={{ width:140, height:105, background:CREAM, border:'1px solid '+HAIR, borderRadius:4, overflow:'hidden', flexShrink:0, position:'relative' }}>
            {asset.public_url ? (
              video ? (
                <video src={asset.public_url} preload="metadata" muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.public_url} alt={asset.original_filename ?? ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              )
            ) : (
              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:INK_M }}>no preview</div>
            )}
            {/* QA badge overlay on thumbnail */}
            <div style={{
              position:'absolute', right:4, bottom:4,
              background: badge.bg, color: badge.fg,
              fontSize: 10, fontWeight: 700, padding:'2px 6px', borderRadius: 3,
              letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums',
            }}>{badge.label}</div>
          </div>
          <div style={{ fontSize:11, color:INK_M, display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
            <div><span style={S.metaK}>Type</span> <span style={S.metaV}>{video ? 'video' : 'image'}</span></div>
            {asset.mime_type && <div><span style={S.metaK}>MIME</span> <span style={S.metaV}>{asset.mime_type}</span></div>}
            {(asset.width_px || asset.height_px) ? <div><span style={S.metaK}>Dim</span> <span style={S.metaV}>{asset.width_px ?? '?'} × {asset.height_px ?? '?'}</span></div> : null}
            {size && <div><span style={S.metaK}>Size</span> <span style={S.metaV}>{size}</span></div>}
            {asset.status && <div><span style={S.metaK}>Status</span> <span style={S.metaV}>{asset.status}</span></div>}
            {asset.created_at && <div><span style={S.metaK}>Created</span> <span style={S.metaV}>{asset.created_at.slice(0,10)}</span></div>}
          </div>
        </div>

        {err && <div style={S.errBanner}>Save failed: {err}</div>}
        {ok  && <div style={S.okBanner}>{ok}</div>}

        <Field label="Filename">
          <input value={filename} onChange={e => setFilename(e.target.value)} style={S.input} />
        </Field>

        <Field label="Caption">
          <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3} style={S.textarea} />
        </Field>

        <Field label="Alt text">
          <textarea value={altText} onChange={e => setAltText(e.target.value)} rows={2} style={S.textarea} />
        </Field>

        <Field label="Quality tier">
          <select value={tier} onChange={e => setTier(e.target.value)} style={S.input}>
            <option value="">(none)</option>
            {TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Field>

        <Field label="Property area">
          {taxonomy ? (() => {
            const knownNames = new Set<string>([
              'Logos', 'No area',
              ...taxonomy.rooms.map(r => r.name),
              ...taxonomy.facilities.map(f => f.name),
              ...taxonomy.activities.map(a => a.name),
              ...taxonomy.meeting_spaces.map(m => m.name),
              ...taxonomy.transport.map(t => t.name),
              ...(taxonomy.boats ?? []).map(b => b.name),
              ...(taxonomy.boat_cruises ?? []).map(c => c.name),
            ]);
            const isLegacy = area !== '' && !knownNames.has(area);
            return (
              <select value={area} onChange={e => setArea(e.target.value)} style={S.input}>
                <option value="">(no property area)</option>
                <option value="Logos">Logos</option>
                <option value="No area">No area</option>
                {taxonomy.rooms.length > 0 && (
                  <optgroup label="Rooms">
                    {taxonomy.rooms.map(r => <option key={`room-${r.id}`} value={r.name}>{r.name}</option>)}
                  </optgroup>
                )}
                {taxonomy.facilities.length > 0 && (
                  <optgroup label="Facilities">
                    {taxonomy.facilities.map(f => (
                      <option key={`fac-${f.id}`} value={f.name}>
                        {f.parent_name ? `${f.name} · ↳ ${f.parent_name}` : f.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {taxonomy.activities.length > 0 && (
                  <optgroup label="Activities">
                    {taxonomy.activities.map(a => (
                      <option key={`act-${a.id}`} value={a.name}>
                        {a.facility_name ? `${a.name} · @ ${a.facility_name}` : a.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {taxonomy.meeting_spaces.length > 0 && (
                  <optgroup label="Meeting spaces">
                    {taxonomy.meeting_spaces.map(m => <option key={`mtg-${m.id}`} value={m.name}>{m.name}</option>)}
                  </optgroup>
                )}
                {taxonomy.transport.length > 0 && (
                  <optgroup label="Transport">
                    {taxonomy.transport.map(t => (
                      <option key={`trp-${t.id}`} value={t.name}>
                        {t.route_from && t.route_to ? `${t.name} · ${t.route_from} → ${t.route_to}` : t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {(taxonomy.boats && taxonomy.boats.length > 0) && (
                  <optgroup label="Imekong · Boats">
                    {taxonomy.boats.map(b => <option key={`boat-${b.id}`} value={b.name}>{b.name}</option>)}
                  </optgroup>
                )}
                {(taxonomy.boat_cruises && taxonomy.boat_cruises.length > 0) && (
                  <optgroup label="Imekong · Cruises">
                    {taxonomy.boat_cruises.map(c => (
                      <option key={`cruise-${c.id}`} value={c.name}>
                        {c.boat_name ? `${c.name} · @ ${c.boat_name}` : c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {isLegacy && (
                  <optgroup label="Legacy (free text)">
                    <option value={area}>{area}</option>
                  </optgroup>
                )}
              </select>
            );
          })() : (
            <>
              <input value={area} onChange={e => setArea(e.target.value)} list="areaOptions" placeholder="e.g. Pool area · Garden · Guest room interior" style={S.input} />
              <datalist id="areaOptions">
                {areaOptions.map(a => <option key={a} value={a} />)}
              </datalist>
            </>
          )}
        </Field>

        {rooms.length > 0 && (
          <Field label="Room category (optional)">
            <select value={roomTypeId} onChange={e => setRoomTypeId(e.target.value)} style={S.input}>
              <option value="">(not a room shot)</option>
              {rooms.map(r => <option key={r.room_type_id} value={r.room_type_id}>{r.room_type_name}</option>)}
            </select>
          </Field>
        )}

        <Field label="AI generated">
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:INK }}>
            <input type="checkbox" checked={aiGen} onChange={e => setAiGen(e.target.checked)} />
            <span>Mark this asset as AI-generated</span>
          </label>
        </Field>

        {video && (
          <details style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:4, padding:'8px 12px' }}>
            <summary style={{ fontSize:11, fontWeight:600, color:INK, cursor:'pointer', letterSpacing:'0.06em', textTransform:'uppercase' }}>Video technical</summary>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:12 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {asset.duration_sec != null && (<span style={S.pill}>Duration · {fmtDurMMSS(asset.duration_sec)}</span>)}
                {asset.aspect_ratio && (<span style={S.pill}>Aspect · {asset.aspect_ratio}</span>)}
                {asset.duration_sec == null && !asset.aspect_ratio && (<span style={{ fontSize:10, color:INK_M }}>Duration / aspect not detected on ingest.</span>)}
              </div>

              <Field label="Captured at">
                <input type="date" value={capturedAt} onChange={e => setCapturedAt(e.target.value)} style={S.input} />
              </Field>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <Field label="Camera make">
                  <input value={cameraMake} onChange={e => setCameraMake(e.target.value)} placeholder="e.g. DJI · Sony · iPhone" style={S.input} />
                </Field>
                <Field label="Camera model">
                  <input value={cameraModel} onChange={e => setCameraModel(e.target.value)} placeholder="e.g. Mavic 3 · A7S III · 15 Pro" style={S.input} />
                </Field>
              </div>

              <Field label="Lens">
                <input value={lens} onChange={e => setLens(e.target.value)} placeholder="e.g. 24-70 f/2.8 · wide · drone stock" style={S.input} />
              </Field>

              <Field label="Audio">
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:INK }}>
                  <input type="checkbox" checked={hasAudio} onChange={e => setHasAudio(e.target.checked)} />
                  <span>This clip has an audio track</span>
                </label>
              </Field>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <Field label="Audio type">
                  <select value={audioType} onChange={e => setAudioType(e.target.value)} style={S.input}>
                    {AUDIO_TYPES.map(a => <option key={a.key || 'unset'} value={a.key}>{a.label}</option>)}
                  </select>
                </Field>
                <Field label="Audio language">
                  <input value={audioLanguage} onChange={e => setAudioLanguage(e.target.value)} placeholder="e.g. en · lo · fr" style={S.input} />
                </Field>
              </div>

              <Field label="Colour profile">
                <select value={colorProfile} onChange={e => setColorProfile(e.target.value)} style={S.input}>
                  {COLOR_PROFILES.map(c => <option key={c.key || 'unset'} value={c.key}>{c.label}</option>)}
                </select>
              </Field>

              <Field label="Visual description">
                <textarea value={visualDescription} onChange={e => setVisualDescription(e.target.value)} rows={3} placeholder="One-sentence description of what's in the clip." style={S.textarea} />
              </Field>
            </div>
          </details>
        )}

        {/* Media QA v1 — collapsible score breakdown */}
        <details style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:4, padding:'8px 12px' }} open={qIndex != null}>
          <summary style={{ fontSize:11, fontWeight:600, color:INK, cursor:'pointer', letterSpacing:'0.06em', textTransform:'uppercase', display:'flex', alignItems:'center', gap:8, justifyContent:'space-between' }}>
            <span>Quality Score · {qIndex == null ? 'not yet scored' : qIndex + '%'}</span>
            <span style={{ background: badge.bg, color: badge.fg, padding: '2px 8px', borderRadius: 3, fontSize: 10 }}>{badge.label}</span>
          </summary>
          <div style={{ display:'flex', flexDirection:'column', gap:14, marginTop:12 }}>
            {qIndex == null ? (
              <div style={{ fontSize:11, color:INK_M }}>
                This asset has not been through the QA engine yet. Click Re-score below to run technical / aesthetic / marketing scoring against the current image.
              </div>
            ) : (
              <>
                {/* Technical */}
                <div>
                  <div style={S.qaSectionHeader}>
                    <span>Technical</span>
                    <span style={{ ...S.qaBadge, ...qaBadgeStyle(asset.technical_score) }}>{asset.technical_score ?? '—'}</span>
                  </div>
                  <QaBar label="Sharpness" value={tech?.sharpness?.value} detail={tech?.sharpness?.detail} />
                  <QaBar label="Exposure"  value={tech?.exposure?.value}  detail={tech?.exposure?.detail} />
                  <QaBar label="Noise"     value={tech?.noise?.value}     detail={tech?.noise?.detail} />
                </div>

                {/* Aesthetic */}
                <div>
                  <div style={S.qaSectionHeader}>
                    <span>Aesthetic</span>
                    <span style={{ ...S.qaBadge, ...qaBadgeStyle(asset.aesthetic_score) }}>{asset.aesthetic_score ?? '—'}</span>
                  </div>
                  <QaBar label="Horizon"   value={aes?.horizon?.value}   detail={aes?.horizon?.detail} />
                  <QaBar label="Clutter"   value={aes?.clutter?.value}   detail={aes?.clutter?.detail} />
                  <QaBar label="Lighting"  value={aes?.lighting?.value}  detail={aes?.lighting?.detail} />
                </div>

                {/* Marketing */}
                <div>
                  <div style={S.qaSectionHeader}>
                    <span>Marketing</span>
                    <span style={{ ...S.qaBadge, ...qaBadgeStyle(asset.marketing_score) }}>{asset.marketing_score ?? '—'}</span>
                  </div>
                  <QaBar label="Bed presentation" value={mkt?.bed_presentation?.value} detail={mkt?.bed_presentation?.detail} />
                  <QaBar label="Distortion"        value={mkt?.distortion?.value}        detail={mkt?.distortion?.detail} />
                  <QaBar label="Commercial polish" value={mkt?.commercial_polish?.value} detail={mkt?.commercial_polish?.detail} />
                </div>

                {/* Naming convention */}
                {naming && (
                  <div style={{ background:CREAM, border:'1px solid '+HAIR, borderRadius: 3, padding: '8px 10px' }}>
                    <div style={S.qaSectionHeader}>
                      <span>Naming convention</span>
                      <span style={{
                        ...S.qaBadge,
                        background: naming.matched === true ? OK : naming.matched === false ? RED : HAIR,
                        color: naming.matched == null ? INK_M : WHITE,
                      }}>{naming.matched === true ? '✓ match' : naming.matched === false ? '✗ off' : 'no rule'}</span>
                    </div>
                    {naming.expected && (
                      <div style={{ fontSize: 10, color: INK_M, fontFamily: 'ui-monospace, Menlo, monospace', marginTop: 4 }}>{naming.expected}</div>
                    )}
                    {Array.isArray(naming.violations) && naming.violations.length > 0 && (
                      <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 10, color: RED }}>
                        {naming.violations.map((v: string, i: number) => <li key={i}>{v}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {/* Detected text & flags */}
                {(asset.detected_text || flags) && (
                  <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 3, padding: '8px 10px' }}>
                    <div style={S.qaSectionHeader}><span>Detected text · flags</span></div>
                    {asset.detected_text && (
                      <div style={{ fontSize: 10, color: INK_M, fontStyle: 'italic', marginTop: 4 }}>
                        "{asset.detected_text.slice(0, 200)}{asset.detected_text.length > 200 ? '…' : ''}"
                      </div>
                    )}
                    {flags && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {flags.has_prices && <span style={{ ...S.pill, background: '#FBEEDC', borderColor: '#B48A3A', color: INK }}>prices visible</span>}
                        {flags.has_pii    && <span style={{ ...S.pill, background: '#F9DAD3', borderColor: RED, color: RED }}>PII risk</span>}
                        {flags.has_logos  && <span style={{ ...S.pill, background: CREAM, borderColor: HAIR, color: INK_M }}>logos</span>}
                        {!flags.has_prices && !flags.has_pii && !flags.has_logos && <span style={{ fontSize: 10, color: INK_M }}>none</span>}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid ' + HAIR, paddingTop: 8 }}>
              <button
                type="button"
                onClick={rescore}
                disabled={rescoring}
                style={{
                  padding: '6px 14px', fontSize: 11, fontWeight: 600,
                  background: rescoring ? INK_M : FOREST, color: WHITE,
                  border: 'none', borderRadius: 3, cursor: rescoring ? 'default' : 'pointer',
                }}
              >{rescoring ? 'Scoring…' : 'Re-score'}</button>
              {rescoreMsg && <span style={{ fontSize: 10, color: INK_M }}>{rescoreMsg}</span>}
              {asset.qa_scored_at && !rescoreMsg && (
                <span style={{ fontSize: 10, color: INK_M }}>
                  scored {String(asset.qa_scored_at).slice(0, 10)} · model {asset.qa_model?.split('-').slice(0,3).join('-') ?? '?'}
                </span>
              )}
            </div>
          </div>
        </details>
      </div>

      {video && (
        <VideoPlayerModal
          open={drawerPlaying}
          onClose={() => setDrawerPlaying(false)}
          asset={asset as VideoPlayerAsset}
        />
      )}
    </Drawer>
  );
}

function qaBadgeStyle(v: number | null | undefined): React.CSSProperties {
  const b = qaBadge(v ?? null);
  return { background: b.bg, color: b.fg };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5A5A5A', marginBottom:4 }}>{label}</div>
      {children}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  input: {
    width: '100%', padding: '8px 10px', fontSize: 13, color: INK,
    background: WHITE, border: '1px solid ' + HAIR, borderRadius: 3, outline: 'none',
  },
  textarea: {
    width: '100%', padding: '8px 10px', fontSize: 13, color: INK, lineHeight: 1.4,
    background: WHITE, border: '1px solid ' + HAIR, borderRadius: 3, outline: 'none',
    resize: 'vertical', fontFamily: 'inherit',
  },
  btnPrimary: {
    padding: '8px 18px', fontSize: 12, fontWeight: 600, background: FOREST, color: WHITE,
    border: 'none', borderRadius: 3, cursor: 'pointer',
  },
  btnGhost: {
    padding: '8px 14px', fontSize: 12, fontWeight: 600, background: WHITE, color: INK,
    border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer',
  },
  errBanner: {
    padding: '8px 12px', fontSize: 12, color: WHITE, background: RED, borderRadius: 3,
  },
  okBanner: {
    padding: '8px 12px', fontSize: 12, color: WHITE, background: OK, borderRadius: 3,
  },
  metaK: { display: 'inline-block', minWidth: 44, color: INK_M },
  metaV: { color: INK, fontWeight: 500 },
  pill: {
    display: 'inline-block', padding: '3px 8px', fontSize: 10, fontWeight: 600,
    color: INK, background: CREAM, border: '1px solid ' + HAIR, borderRadius: 12,
    letterSpacing: '0.02em',
  },
  qaSectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 11, fontWeight: 700, color: INK, marginBottom: 6,
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  qaBadge: {
    padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 3, letterSpacing: '0.02em',
    fontVariantNumeric: 'tabular-nums',
  },
};
