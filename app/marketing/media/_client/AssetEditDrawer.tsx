// app/marketing/media/_client/AssetEditDrawer.tsx
// PBS 2026-07-12 — Reusable Edit ✎ drawer, mounted from LibraryTab + ClarifyTab.
// Uses the canonical <Drawer/> primitive from @/app/(cockpit)/_design.
// POSTs to /api/marketing/media/asset-update. On success calls router.refresh()
// via the onSaved() prop so parent re-fetches and updated row leaves Clarify grid.
// 2026-07-13 · Coordinator scope-add — for video assets:
//   (1) ▶ Play video button at top of body opens VideoPlayerModal.
//   (2) Collapsible "Video technical" details block with duration/aspect/
//       capture date, camera fields, audio, colour profile, visual description.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '@/app/(cockpit)/_design';
import VideoPlayerModal, { type VideoPlayerAsset } from './VideoPlayerModal';

export interface RoomOption { room_type_id: number; room_type_name: string; }

// 2026-07-12 pm: mirrors MediaHub.MediaTaxonomy — kept local so this drawer can
// be imported without pulling in the whole hub file. Optional so legacy callers
// still work with datalist mode.
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
  // Video-specific (optional; may be null for photos or older uploads)
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

  // Video-specific state
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

  useEffect(() => {
    if (!open || !asset) return;
    setErr(null); setOk(null);
    setFilename(asset.original_filename ?? '');
    setCaption(asset.caption ?? '');
    setAltText(asset.alt_text ?? '');
    setTier(asset.primary_tier ?? '');
    setArea(asset.property_area ?? '');
    setAiGen(Boolean(asset.is_ai_generated));
    setRoomTypeId(asset.room_type_id != null ? String(asset.room_type_id) : '');
    // Video-specific — trimmed to yyyy-mm-dd for the date input
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

      // Video-specific diffs (only emitted when the asset is a video)
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
      // small delay so PBS sees the banner
      setTimeout(() => { onClose(); }, 700);
    } catch (e: any) {
      setErr(e.message ?? 'unknown');
    } finally {
      setSaving(false);
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

        {/* Thumbnail + read-only meta */}
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ width:140, height:105, background:'#F5F0E1', border:'1px solid '+HAIR, borderRadius:4, overflow:'hidden', flexShrink:0 }}>
            {asset.public_url ? (
              video ? (
                // Browser renders first frame as poster with preload='metadata'
                <video src={asset.public_url} preload="metadata" muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.public_url} alt={asset.original_filename ?? ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              )
            ) : (
              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:INK_M }}>no preview</div>
            )}
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
            // 2026-07-12 pm: 5-category structured select mirrors Settings sidebar.
            // Any name added in Settings surfaces here on next page load.
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
              {/* Read-only pills: duration + aspect ratio */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {asset.duration_sec != null && (
                  <span style={S.pill}>Duration · {fmtDurMMSS(asset.duration_sec)}</span>
                )}
                {asset.aspect_ratio && (
                  <span style={S.pill}>Aspect · {asset.aspect_ratio}</span>
                )}
                {asset.duration_sec == null && !asset.aspect_ratio && (
                  <span style={{ fontSize:10, color:INK_M }}>Duration / aspect not detected on ingest.</span>
                )}
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
                <textarea value={visualDescription} onChange={e => setVisualDescription(e.target.value)} rows={3} placeholder="One-sentence description of what's in the clip — used for AI search and channel routing." style={S.textarea} />
              </Field>
            </div>
          </details>
        )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, marginBottom:4 }}>{label}</div>
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
    color: INK, background: '#F5F0E1', border: '1px solid ' + HAIR, borderRadius: 12,
    letterSpacing: '0.02em',
  },
};
