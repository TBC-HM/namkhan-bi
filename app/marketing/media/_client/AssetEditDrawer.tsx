// app/marketing/media/_client/AssetEditDrawer.tsx
// PBS 2026-07-12 — Reusable Edit ✎ drawer, mounted from LibraryTab + ClarifyTab.
// 2026-07-13 · Video meta section (duration/aspect/camera/audio/color/desc).
// 2026-07-13 pm · MEDIA QA v1 — collapsible "Quality Score" breakdown with
//   tech/aes/mkt bars, naming-convention check, detected-text flags, and
//   Re-score button that POSTs to /api/marketing/media/qa-rescore.
// 2026-07-14 · MEDIA QA v2 — per-slider Iris reasoning + failures[] chips,
//   filename header now shows the SEO name with an info tooltip pointing to
//   the original + storage path, "Crop to…" dropdown appears when qa_notes
//   carries an aspect_ratio failure AND source dims meet a channel's minimum,
//   "Rescore" button relabelled "Regenerate & re-apply".
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
  property_id?: number | null;
  room_type_id?: number | null;
  original_filename?: string | null;
  seo_target_filename?: string | null;
  raw_path?: string | null;
  caption?: string | null;
  alt_text?: string | null;
  primary_tier?: string | null;
  property_area?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
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
  technical_score?: number | null;
  aesthetic_score?: number | null;
  marketing_score?: number | null;
  quality_index?: number | null;
  qa_notes?: any;
  qa_model?: string | null;
  qa_scored_at?: string | null;
  detected_text?: string | null;
}

interface AspectRule { channel: string; ratio: string; min_width_px: number; min_height_px: number; }
let __ASPECT_RULES_CACHE: AspectRule[] | null = null;
async function loadAspectRules(): Promise<AspectRule[]> {
  if (__ASPECT_RULES_CACHE) return __ASPECT_RULES_CACHE;
  try {
    const res = await fetch('/api/marketing/media/aspect-rules', { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      if (Array.isArray(j?.rules)) { __ASPECT_RULES_CACHE = j.rules as AspectRule[]; return __ASPECT_RULES_CACHE; }
    }
  } catch { /* fall through */ }
  __ASPECT_RULES_CACHE = [
    { channel: 'yt_hero',  ratio: '16:9', min_width_px: 1920, min_height_px: 1080 },
    { channel: 'yt_thumb', ratio: '16:9', min_width_px: 1280, min_height_px: 720 },
    { channel: 'ig_feed',  ratio: '1:1',  min_width_px: 1080, min_height_px: 1080 },
    { channel: 'ig_reel',  ratio: '9:16', min_width_px: 1080, min_height_px: 1920 },
    { channel: 'tiktok',   ratio: '9:16', min_width_px: 1080, min_height_px: 1920 },
    { channel: 'web_hero', ratio: '3:2',  min_width_px: 2400, min_height_px: 1600 },
    { channel: 'ota_hero', ratio: '4:3',  min_width_px: 2048, min_height_px: 1536 },
    { channel: 'brochure', ratio: '3:2',  min_width_px: 2400, min_height_px: 1600 },
  ];
  return __ASPECT_RULES_CACHE;
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
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtDurMMSS(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(Number(sec))) return '';
  const s = Math.round(Number(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

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
  // PBS 2026-07-14 · SEO Local · GPS lat/lng surfaced in the drawer.
  const [gpsLat, setGpsLat] = useState<string>('');
  const [gpsLng, setGpsLng] = useState<string>('');

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

  const [rescoring, setRescoring] = useState(false);
  const [rescoreMsg, setRescoreMsg] = useState<string | null>(null);

  const [aspectRules, setAspectRules] = useState<AspectRule[]>([]);
  const [cropBusy, setCropBusy] = useState(false);
  const [cropMsg, setCropMsg] = useState<string | null>(null);

  const [tSlider, setTSlider] = useState<number | null>(null);
  const [aSlider, setASlider] = useState<number | null>(null);
  const [mSlider, setMSlider] = useState<number | null>(null);
  const [savingScores, setSavingScores] = useState(false);
  const [savedScoresMsg, setSavedScoresMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !asset) return;
    setErr(null); setOk(null); setRescoreMsg(null); setCropMsg(null);
    void loadAspectRules().then(setAspectRules).catch(() => setAspectRules([]));
    setFilename(asset.original_filename ?? '');
    setCaption(asset.caption ?? '');
    setAltText(asset.alt_text ?? '');
    setTier(asset.primary_tier ?? '');
    setArea(asset.property_area ?? '');
    setAiGen(Boolean(asset.is_ai_generated));
    setRoomTypeId(asset.room_type_id != null ? String(asset.room_type_id) : '');
    // PBS 2026-07-21 · Default GPS = Namkhan centre (19.8563, 102.1354) when both null AND property matches.
    // Drawer is Namkhan-only in practice; if property_id is missing on the row we still default (safe).
    const propId = asset.property_id ?? 260955;
    const isNamkhan = propId === 260955;
    const shouldDefault = isNamkhan && asset.gps_lat == null && asset.gps_lng == null;
    setGpsLat(asset.gps_lat != null ? String(asset.gps_lat) : (shouldDefault ? '19.8563' : ''));
    setGpsLng(asset.gps_lng != null ? String(asset.gps_lng) : (shouldDefault ? '102.1354' : ''));
    setCapturedAt(asset.captured_at ? String(asset.captured_at).slice(0, 10) : '');
    setCameraMake(asset.camera_make ?? '');
    setCameraModel(asset.camera_model ?? '');
    setLens(asset.lens ?? '');
    setHasAudio(Boolean(asset.has_audio));
    setAudioType(asset.audio_type ?? '');
    setAudioLanguage(asset.audio_language ?? '');
    setColorProfile(asset.color_profile ?? '');
    setVisualDescription(asset.visual_description ?? '');
    setTSlider(asset.technical_score ?? null);
    setASlider(asset.aesthetic_score ?? null);
    setMSlider(asset.marketing_score ?? null);
    setSavedScoresMsg(null);
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
      // PBS 2026-07-15 · #205 · resolve the selected area name to the right FK so photo moves OUT of "Other X" bucket.
      // PBS 2026-07-21 · when reassigning area, clear ALL mutually-exclusive FKs
      // so photo actually moves out of the old area folder. Previously only
      // facility/activity were touched; old room_type_id/cert/contact/destination
      // lingered and photo appeared in both old and new folders.
      const areaChanged = area !== (asset.property_area ?? '');
      if (areaChanged) {
        const norm = (s: string) => s.trim().toLowerCase();
        const target = norm(area);
        let matchedFacility: number | null = null;
        let matchedActivity: number | null = null;
        let matchedRoom: number | null = null;
        if (target) {
          for (const f of (taxonomy?.facilities ?? [])) { if (norm(f.name) === target) { matchedFacility = f.id; break; } }
          if (matchedFacility == null) {
            for (const a of (taxonomy?.activities ?? [])) { if (norm(a.name) === target) { matchedActivity = a.id; break; } }
          }
          if (matchedFacility == null && matchedActivity == null) {
            for (const r of (taxonomy?.rooms ?? [])) { if (norm(r.name) === target) { matchedRoom = r.id; break; } }
          }
        }
        // Clear every mutually-exclusive FK the RPC knows about, then set the matched one.
        // destination_id / boat_id / boat_cruise_id / transport_id aren't in fn_media_asset_update's
        // CASE WHEN guards so passing them here would be no-ops — skip.
        payload.facility_id      = matchedFacility;   // null if not matched
        payload.activity_id      = matchedActivity;   // null if not matched
        payload.room_type_id     = matchedRoom != null ? String(matchedRoom) : null;
        payload.certification_id = null;
        payload.contact_id       = null;
      }
      if (aiGen   !== Boolean(asset.is_ai_generated))    payload.is_ai_generated = aiGen;
      const currentRoom = asset.room_type_id != null ? String(asset.room_type_id) : '';
      // Only honour the room dropdown's explicit change when area DIDN'T change;
      // otherwise the area-change block above owns the FK reassignment.
      if (!areaChanged && roomTypeId !== currentRoom) payload.room_type_id = roomTypeId || null;
      const currentLat = asset.gps_lat != null ? String(asset.gps_lat) : '';
      const currentLng = asset.gps_lng != null ? String(asset.gps_lng) : '';
      if (gpsLat !== currentLat) payload.gps_lat = gpsLat === '' ? null : Number(gpsLat);
      if (gpsLng !== currentLng) payload.gps_lng = gpsLng === '' ? null : Number(gpsLng);

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
    setRescoring(true); setRescoreMsg('Regenerating with Iris… (~40s per image)');
    try {
      const res = await fetch('/api/marketing/media/qa-rescore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: asset.asset_id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'rescore_failed');
      const r = j.result ?? {};
      setRescoreMsg('Regenerated ✓ · tech ' + (r.technical_score ?? '?') + ' · aes ' + (r.aesthetic_score ?? '?') + ' · mkt ' + (r.marketing_score ?? '?') + ' · quality ' + (r.quality_index ?? '?') + '%');
      if (typeof r.technical_score === 'number') setTSlider(r.technical_score);
      if (typeof r.aesthetic_score === 'number') setASlider(r.aesthetic_score);
      if (typeof r.marketing_score === 'number') setMSlider(r.marketing_score);
      router.refresh();
    } catch (e: any) {
      setRescoreMsg('Rescore failed: ' + e.message);
    } finally {
      setRescoring(false);
    }
  }

  async function saveScores() {
    if (!asset) return;
    setSavingScores(true); setSavedScoresMsg(null);
    try {
      const baseNotes = (asset.qa_notes ?? {}) as any;
      const merged = { ...baseNotes, manual_override: {
        by: 'PBS', at: new Date().toISOString(),
        technical: tSlider, aesthetic: aSlider, marketing: mSlider,
      }};
      const res = await fetch('/api/marketing/media/asset-qa-save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: asset.asset_id,
          technical: tSlider, aesthetic: aSlider, marketing: mSlider,
          notes: merged,
          model: asset.qa_model ?? 'manual',
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'save_failed');
      setSavedScoresMsg('Scores saved ✓');
      router.refresh();
    } catch (e: any) {
      setSavedScoresMsg('Save failed: ' + e.message);
    } finally {
      setSavingScores(false);
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

        {/* Filename header — display SEO name (from Iris) with hover tooltip showing
            the original + storage path. The <input> below is the editable working
            filename that gets persisted via fn_media_asset_update. */}
        <div>
          <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
            <span>Filename</span>
            <span
              title={
                (asset.original_filename ? 'Original: ' + asset.original_filename + '\n' : '') +
                (asset.master_path ? 'Master path: ' + asset.master_path + '\n' : '') +
                (asset.raw_path ? 'Raw path: ' + asset.raw_path : '')
              }
              style={{
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                width:14, height:14, borderRadius:7, border:'1px solid '+HAIR,
                fontSize:9, color:INK_M, cursor:'help', background:WHITE,
              }}
            >?</span>
            {asset.seo_target_filename && (
              <span style={{ fontStyle:'italic', color:INK_M, fontSize:10 }}>Iris SEO name applied</span>
            )}
          </div>
          <input value={filename} onChange={e => setFilename(e.target.value)} style={S.input} />
        </div>

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
                    {taxonomy.rooms.map(r => <option key={'room-' + r.id} value={r.name}>{r.name}</option>)}
                  </optgroup>
                )}
                {taxonomy.facilities.length > 0 && (
                  <optgroup label="Facilities">
                    {taxonomy.facilities.map(f => (
                      <option key={'fac-' + f.id} value={f.name}>
                        {f.parent_name ? f.name + ' · ↳ ' + f.parent_name : f.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {taxonomy.activities.length > 0 && (
                  <optgroup label="Activities">
                    {taxonomy.activities.map(a => (
                      <option key={'act-' + a.id} value={a.name}>
                        {a.facility_name ? a.name + ' · @ ' + a.facility_name : a.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {taxonomy.meeting_spaces.length > 0 && (
                  <optgroup label="Meeting spaces">
                    {taxonomy.meeting_spaces.map(m => <option key={'mtg-' + m.id} value={m.name}>{m.name}</option>)}
                  </optgroup>
                )}
                {taxonomy.transport.length > 0 && (
                  <optgroup label="Transport">
                    {taxonomy.transport.map(t => (
                      <option key={'trp-' + t.id} value={t.name}>
                        {t.route_from && t.route_to ? t.name + ' · ' + t.route_from + ' → ' + t.route_to : t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {(taxonomy.boats && taxonomy.boats.length > 0) && (
                  <optgroup label="Imekong · Boats">
                    {taxonomy.boats.map(b => <option key={'boat-' + b.id} value={b.name}>{b.name}</option>)}
                  </optgroup>
                )}
                {(taxonomy.boat_cruises && taxonomy.boat_cruises.length > 0) && (
                  <optgroup label="Imekong · Cruises">
                    {taxonomy.boat_cruises.map(c => (
                      <option key={'cruise-' + c.id} value={c.name}>
                        {c.boat_name ? c.name + ' · @ ' + c.boat_name : c.name}
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

        {/* PBS 2026-07-14 · SEO Local — GPS lat/lng. Values feed local-SEO downloads (search engines pick up geo metadata). */}
        <Field label="SEO Local · GPS coordinates">
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <input type="number" step="0.0001" placeholder="lat (e.g. 19.8563)" value={gpsLat} onChange={e => setGpsLat(e.target.value)} style={{ ...S.input, maxWidth:150 }} />
            <input type="number" step="0.0001" placeholder="lng (e.g. 102.1354)" value={gpsLng} onChange={e => setGpsLng(e.target.value)} style={{ ...S.input, maxWidth:150 }} />
            <button type="button" onClick={() => { setGpsLat(''); setGpsLng(''); }} style={{ padding:'6px 10px', fontSize:11, background:'#FFFFFF', color:INK_M, border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer' }}>Clear</button>
            {gpsLat && gpsLng && (
              <a href={`https://www.google.com/maps?q=${gpsLat},${gpsLng}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#084838', textDecoration:'underline' }}>View on Google Maps →</a>
            )}
          </div>
          <div style={{ fontSize:10, color:INK_M, marginTop:4 }}>Default: The Namkhan Luang Prabang (19.8563, 102.1354). Edit only for photos taken off-property.</div>
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
                <textarea value={visualDescription} onChange={e => setVisualDescription(e.target.value)} rows={3} placeholder="One-sentence description of what is in the clip." style={S.textarea} />
              </Field>
            </div>
          </details>
        )}

        <details style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:4, padding:'8px 12px' }} open={qIndex != null}>
          <summary style={{ fontSize:11, fontWeight:600, color:INK, cursor:'pointer', letterSpacing:'0.06em', textTransform:'uppercase', display:'flex', alignItems:'center', gap:8, justifyContent:'space-between' }}>
            <span>Quality Score · {qIndex == null ? 'not yet scored' : qIndex + '%'}</span>
            <span style={{ background: badge.bg, color: badge.fg, padding: '2px 8px', borderRadius: 3, fontSize: 10 }}>{badge.label}</span>
          </summary>
          <div style={{ display:'flex', flexDirection:'column', gap:14, marginTop:12 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:10, background:CREAM, border:'1px solid '+HAIR, borderRadius:3, padding:10 }}>
              <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600 }}>Manual override</div>
              <SliderRow label="Technical" value={tSlider} setValue={setTSlider} reasoning={notes?.technical_reasoning ?? null} />
              <SliderRow label="Aesthetic" value={aSlider} setValue={setASlider} reasoning={notes?.aesthetic_reasoning ?? null} />
              <SliderRow label="Marketing" value={mSlider} setValue={setMSlider} reasoning={notes?.marketing_reasoning ?? null} />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid '+HAIR, paddingTop:8, marginTop:2 }}>
                <span style={{ fontSize:11, color:INK, fontWeight:600 }}>Composite</span>
                <span style={{ fontSize:12, color:INK, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>
                  {(() => {
                    const t = tSlider ?? 0, a = aSlider ?? 0, m = mSlider ?? 0;
                    if (tSlider == null && aSlider == null && mSlider == null) return '—';
                    return Math.round(t*0.4 + a*0.3 + m*0.3) + '%';
                  })()}
                </span>
              </div>
              <FailureChips failures={notes?.failures} />

              {(() => {
                const failures = Array.isArray(notes?.failures) ? notes!.failures : [];
                const hasAspectFail = failures.some((f: any) =>
                  f && typeof f.rule_type === 'string' && f.rule_type.toLowerCase().startsWith('aspect'));
                if (!hasAspectFail) return null;
                const srcW = Number(asset.width_px ?? 0);
                const srcH = Number(asset.height_px ?? 0);
                const eligible = aspectRules.filter(r =>
                  srcW >= r.min_width_px && srcH >= r.min_height_px);
                return (
                  <div style={{ borderTop:'1px solid '+HAIR, paddingTop:8, display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600 }}>
                      Crop to aspect
                    </div>
                    {eligible.length === 0 ? (
                      <div style={{ fontSize:10, color:INK_M }}>Source too small to crop to any channel.</div>
                    ) : (
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                        <select
                          disabled={cropBusy}
                          defaultValue=""
                          onChange={async (e) => {
                            const channel = e.currentTarget.value;
                            e.currentTarget.value = '';
                            if (!channel) return;
                            if (!window.confirm('Crop this master to ' + channel + '? This overwrites master_path.')) return;
                            setCropBusy(true); setCropMsg('Cropping to ' + channel + '…');
                            try {
                              const res = await fetch('/api/marketing/media/crop-to-aspect', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ asset_id: asset.asset_id, channel }),
                              });
                              const j = await res.json();
                              if (!res.ok || !j.ok) throw new Error(j.error || 'crop_failed');
                              setCropMsg('Cropped ✓ ' + channel + ' · ' + (j.output?.width_px) + '×' + (j.output?.height_px));
                              router.refresh();
                            } catch (e: any) {
                              setCropMsg('Crop failed: ' + e.message);
                            } finally {
                              setCropBusy(false);
                            }
                          }}
                          style={{ padding:'4px 8px', fontSize:11, border:'1px solid '+HAIR, borderRadius:3, background:WHITE, color:INK }}
                        >
                          <option value="">Crop to…</option>
                          {eligible.map(r => (
                            <option key={r.channel} value={r.channel}>
                              {r.channel} · {r.ratio} · min {r.min_width_px}×{r.min_height_px}
                            </option>
                          ))}
                        </select>
                        {cropMsg && <span style={{ fontSize:10, color:INK_M }}>{cropMsg}</span>}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button type="button" onClick={saveScores} disabled={savingScores || (tSlider == null && aSlider == null && mSlider == null)}
                  style={{ padding:'6px 14px', fontSize:11, fontWeight:600, background: savingScores ? INK_M : FOREST, color:WHITE, border:'none', borderRadius:3, cursor: savingScores ? 'default' : 'pointer' }}>
                  {savingScores ? 'Saving…' : 'Save Scores'}
                </button>
                <button type="button" onClick={rescore} disabled={rescoring}
                  style={{ padding:'6px 14px', fontSize:11, fontWeight:600, background: rescoring ? INK_M : WHITE, color: rescoring ? WHITE : INK, border:'1px solid '+HAIR, borderRadius:3, cursor: rescoring ? 'default' : 'pointer' }}>
                  {rescoring ? 'Scoring…' : 'Regenerate & re-apply'}
                </button>
                {savedScoresMsg && <span style={{ fontSize:10, color:INK_M }}>{savedScoresMsg}</span>}
                {rescoreMsg && !savedScoresMsg && <span style={{ fontSize:10, color:INK_M }}>{rescoreMsg}</span>}
              </div>
            </div>

            {qIndex == null ? (
              <div style={{ fontSize:11, color:INK_M }}>
                Not yet scored by Iris. Use the sliders above for a manual score, or click <b>Regenerate & re-apply</b> to run the model.
              </div>
            ) : (
              <>
                <div>
                  <div style={S.qaSectionHeader}>
                    <span>Technical</span>
                    <span style={{ ...S.qaBadge, ...qaBadgeStyle(asset.technical_score) }}>{asset.technical_score ?? '—'}</span>
                  </div>
                  <QaBar label="Sharpness" value={tech?.sharpness?.value} detail={tech?.sharpness?.detail} />
                  <QaBar label="Exposure"  value={tech?.exposure?.value}  detail={tech?.exposure?.detail} />
                  <QaBar label="Noise"     value={tech?.noise?.value}     detail={tech?.noise?.detail} />
                </div>

                <div>
                  <div style={S.qaSectionHeader}>
                    <span>Aesthetic</span>
                    <span style={{ ...S.qaBadge, ...qaBadgeStyle(asset.aesthetic_score) }}>{asset.aesthetic_score ?? '—'}</span>
                  </div>
                  <QaBar label="Horizon"   value={aes?.horizon?.value}   detail={aes?.horizon?.detail} />
                  <QaBar label="Clutter"   value={aes?.clutter?.value}   detail={aes?.clutter?.detail} />
                  <QaBar label="Lighting"  value={aes?.lighting?.value}  detail={aes?.lighting?.detail} />
                </div>

                <div>
                  <div style={S.qaSectionHeader}>
                    <span>Marketing</span>
                    <span style={{ ...S.qaBadge, ...qaBadgeStyle(asset.marketing_score) }}>{asset.marketing_score ?? '—'}</span>
                  </div>
                  <QaBar label="Bed presentation" value={mkt?.bed_presentation?.value} detail={mkt?.bed_presentation?.detail} />
                  <QaBar label="Distortion"        value={mkt?.distortion?.value}        detail={mkt?.distortion?.detail} />
                  <QaBar label="Commercial polish" value={mkt?.commercial_polish?.value} detail={mkt?.commercial_polish?.detail} />
                </div>

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

            {asset.qa_scored_at && (
              <div style={{ fontSize: 10, color: INK_M, borderTop: '1px solid ' + HAIR, paddingTop: 6 }}>
                Scored by {asset.qa_model?.split('-').slice(0,3).join('-') ?? '?'} · {String(asset.qa_scored_at).slice(0, 10)}
              </div>
            )}
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

function SliderRow({ label, value, setValue, reasoning }: { label: string; value: number | null; setValue: (v: number | null) => void; reasoning?: string | null }) {
  const text = reasoning && reasoning.trim() ? reasoning.trim() : null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <div style={{ display:'grid', gridTemplateColumns:'78px 1fr 34px', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:11, color:'#1B1B1B', fontWeight:600 }}>{label}</span>
        <input
          type="range" min={0} max={100} step={1}
          value={value ?? 0}
          onChange={e => setValue(Number(e.target.value))}
          style={{ width:'100%', accentColor:'#1B1B1B' }}
        />
        <span style={{ fontSize:11, color:'#1B1B1B', fontVariantNumeric:'tabular-nums', textAlign:'right' }}>{value ?? '—'}</span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: '#8B7355',
          fontStyle: 'italic',
          lineHeight: 1.4,
          marginLeft: 86,
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {text ?? '— no reasoning recorded'}
      </div>
    </div>
  );
}

function FailureChips({ failures }: { failures: any[] | null | undefined }) {
  const list = Array.isArray(failures) ? failures.filter((f) => f && typeof f === 'object') : [];
  if (list.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {list.map((f: any, i: number) => {
        const rt = String(f.rule_type ?? 'rule');
        const rd = String(f.rule_detail ?? '');
        return (
          <span
            key={i}
            title={rd}
            style={{
              display: 'inline-block',
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 600,
              color: '#B84A2C',
              background: '#FFF6F2',
              border: '1px solid #B84A2C',
              borderRadius: 12,
              letterSpacing: '0.02em',
              maxWidth: 340,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {rt}{rd ? ' · ' + rd : ''}
          </span>
        );
      })}
    </div>
  );
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
