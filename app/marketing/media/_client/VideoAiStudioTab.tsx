// app/marketing/media/_client/VideoAiStudioTab.tsx
// PBS 2026-07-13 · Video AI Studio v1 — prompt-first workflow.
// Two-state view: PROMPT input → PREVIEW (shots + script + thumbnails + music).
// Legacy composer preserved in git history (task #148 revision 1).
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PromptCategory, RoomOption, FacilityOption, MediaTaxonomy } from './MediaHub';

interface MediaRow {
  asset_id: string; asset_type?: string;
  original_filename: string; public_url: string | null;
  primary_tier: string | null; property_area: string | null;
  mime_type?: string | null; master_path?: string | null;
  duration_sec?: number | null;
}
interface ChannelSpec { channel: string; display_name: string; video_aspect_ratio: string | null; video_max_duration_sec: number | null; }
interface VideoTemplate {
  template_key: string; display_name: string; description: string | null;
  duration_sec: number; min_assets: number; max_assets: number; aspect: string;
}
interface VideoEditRow {
  id: string; property_id: number; title: string | null; channel: string;
  aspect: string | null; timeline: any; source_asset_ids: string[] | null;
  status: string; shotstack_render_id: string | null; output_asset_id: string | null;
  cost_eur: number | null; cost_cap_eur: number | null; created_by: string | null;
  created_at: string; rendered_at: string | null;
  error_msg?: string | null;
  thumbnails?: any;
  design_prompt?: string | null;
}
interface Props {
  propertyId: number;
  mediaPage: MediaRow[];
  channelSpecs: ChannelSpec[];
  videoEdits: VideoEditRow[];
  templates: VideoTemplate[];
  categories: PromptCategory[];
  rooms: RoomOption[];
  facilities: FacilityOption[];
  taxonomy: MediaTaxonomy;
  initialSourceAssetId?: string | null;
}

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const RED    = '#B03826';

type Length = 15|30|60|90|180;
type Style  = 'cinematic'|'snappy'|'editorial'|'casual';
type Channel = 'youtube_16_9'|'youtube_shorts_9_16'|'instagram_reels'|'tiktok'|'facebook'|'website_hero';
type VoiceMode = 'none'|'openai_tts'|'upload';
type Voice = 'alloy'|'echo'|'fable'|'onyx'|'nova'|'shimmer';
type MusicMood = 'none'|'ambient'|'upbeat'|'emotional'|'cinematic';

const LENGTH_CHOICES: Array<{ v: Length; label: string }> = [
  { v: 15, label: '15s' }, { v: 30, label: '30s' }, { v: 60, label: '60s' },
  { v: 90, label: '90s' }, { v: 180, label: '3min' },
];
const STYLE_CHOICES: Array<{ v: Style; label: string; hint: string }> = [
  { v: 'cinematic', label: 'Cinematic', hint: 'Slow, wide, emotional' },
  { v: 'snappy',    label: 'Snappy',    hint: 'Fast cuts, TikTok energy' },
  { v: 'editorial', label: 'Editorial', hint: 'Documentary rhythm' },
  { v: 'casual',    label: 'Casual',    hint: 'Warm, friendly, unpolished' },
];
const CHANNEL_CHOICES: Array<{ v: Channel; label: string; aspect: string }> = [
  { v: 'youtube_16_9',        label: 'YT 16:9',    aspect: '16:9' },
  { v: 'youtube_shorts_9_16', label: 'Shorts',     aspect: '9:16' },
  { v: 'instagram_reels',     label: 'Reels 9:16', aspect: '9:16' },
  { v: 'tiktok',              label: 'TikTok',     aspect: '9:16' },
  { v: 'website_hero',        label: 'Web Hero',   aspect: '16:9' },
];
const VOICE_CHOICES: Voice[] = ['alloy','echo','fable','onyx','nova','shimmer'];
const MOOD_CHOICES: MusicMood[] = ['none','ambient','upbeat','emotional','cinematic'];

interface DesignResult {
  ok: boolean;
  shots: Array<{ asset_id: string; public_url: string; area: string | null; tier: string | null; reason: string | null }>;
  script: string;
  scenes: string[];
  keywords: string[];
  music: { title: string; artist: string | null; url: string; mood_tags: string[]; source: string } | null;
  thumbnails: Array<{ channel: string; display_name: string; width: number; height: number; url: string | null }>;
  thumbnail_asset_id: string | null;
  edl_preview: any;
  total_duration_sec: number;
  preset: any;
  error?: string;
  detail?: string;
}

export default function VideoAiStudioTab({
  propertyId, mediaPage, channelSpecs, videoEdits, templates,
  categories, rooms, facilities, taxonomy, initialSourceAssetId,
}: Props) {
  // Prompt-first state
  const [prompt, setPrompt] = useState<string>('');
  const [length, setLength] = useState<Length>(30);
  const [style, setStyle] = useState<Style>('cinematic');
  const [channel, setChannel] = useState<Channel>('youtube_16_9');
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('openai_tts');
  const [voice, setVoice] = useState<Voice>('nova');
  const [musicMood, setMusicMood] = useState<MusicMood>('ambient');
  const [areas, setAreas] = useState<Record<string, boolean>>({ Rooms: true, 'F&B': true, Wellness: true, River: true, Recreation: false });
  const [title, setTitle] = useState<string>('THE NAMKHAN');
  const [tagline, setTagline] = useState<string>('Luang Prabang · Laos');

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok'|'err'|'warn'; text: string } | null>(null);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [rows, setRows] = useState<VideoEditRow[]>(videoEdits);
  const [rendering, setRendering] = useState<boolean>(false);

  // Suggested area chips derived from mediaPage
  const areaChips = useMemo(() => {
    const set = new Set<string>();
    for (const r of mediaPage) if (r.property_area) set.add(r.property_area);
    return Array.from(set).slice(0, 12);
  }, [mediaPage]);

  useEffect(() => {
    // Poll rendering rows every 12s
    const timer = setInterval(async () => {
      const pending = rows.filter(r => r.status === 'rendering' || r.status === 'queued');
      if (pending.length === 0) return;
      for (const r of pending) {
        try {
          const res = await fetch('/api/marketing/media/video-render?id=' + r.id, { cache: 'no-store' });
          const j = await res.json();
          if (j?.ok && j?.row) setRows(prev => prev.map(x => x.id === r.id ? j.row : x));
        } catch { /* silent */ }
      }
    }, 12000);
    return () => clearInterval(timer);
  }, [rows]);

  async function designVideo() {
    if (!prompt.trim()) { setBanner({ tone: 'err', text: 'Enter a prompt first' }); return; }
    setBusy(true); setBanner(null); setResult(null);
    try {
      const includedAreas = Object.entries(areas).filter(([, v]) => v).map(([k]) => k);
      const res = await fetch('/api/marketing/media/video-design', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          prompt: prompt.trim(),
          length_sec: length,
          style, channel,
          voiceover_mode: voiceMode,
          voice_id: voice,
          music_mood: musicMood,
          areas_included: includedAreas,
          title, tagline,
          include_thumbnails: true,
        }),
      });
      const j = (await res.json()) as DesignResult;
      if (!res.ok || !j.ok) {
        setBanner({ tone: 'err', text: 'Design failed: ' + (j.error ?? 'unknown') + (j.detail ? ' — ' + j.detail : '') });
      } else {
        setResult(j);
        setBanner({ tone: 'ok', text: 'Design ready · ' + j.shots.length + ' shots · ~' + Math.round(j.total_duration_sec) + 's' });
      }
    } catch (e: any) {
      setBanner({ tone: 'err', text: 'Crashed: ' + (e?.message ?? 'unknown') });
    } finally { setBusy(false); }
  }

  async function renderFull() {
    if (!result?.edl_preview) return;
    setRendering(true); setBanner(null);
    try {
      const res = await fetch('/api/marketing/media/video-render', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          title, channel, aspect: CHANNEL_CHOICES.find(c => c.v === channel)?.aspect ?? '16:9',
          edl: result.edl_preview,
          thumbnails: result.thumbnails,
          voiceover_script: voiceMode === 'openai_tts' ? result.script : null,
          voice_id: voice,
          design_prompt: prompt,
          style_key: style,
          source_asset_ids: result.shots.map(s => s.asset_id),
          cost_cap_eur: 5,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setBanner({ tone: 'err', text: 'Render failed: ' + (j.error ?? 'unknown') + (j.detail ? ' — ' + j.detail : '') });
      } else {
        setBanner({ tone: 'ok', text: 'Render dispatched · ' + (j.row?.shotstack_render_id ?? j.id) });
        if (j.row) setRows(prev => [j.row, ...prev]);
      }
    } catch (e: any) {
      setBanner({ tone: 'err', text: 'Crashed: ' + (e?.message ?? 'unknown') });
    } finally { setRendering(false); }
  }

  function resetDesign() { setResult(null); setBanner(null); }

  return (
    <div>
      {/* Banner */}
      {banner && (
        <div style={{
          padding: '8px 12px', marginBottom: 12,
          background: banner.tone === 'err' ? '#FCE9E5' : banner.tone === 'warn' ? '#FBF3DC' : '#E5F3EC',
          border: '1px solid ' + (banner.tone === 'err' ? RED : banner.tone === 'warn' ? '#B48A3A' : FOREST),
          borderRadius: 4, fontSize: 12, color: INK,
        }}>
          {banner.text}
          <button onClick={() => setBanner(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: INK_M }}>×</button>
        </div>
      )}

      {!result ? (
        // ── PROMPT VIEW ───────────────────────────────────────────
        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_M, fontWeight: 700, marginBottom: 12 }}>
            Prompt-first video studio
          </div>

          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder='Sunset promo — pool, villas, ROOTS dinner'
            rows={3}
            style={{
              width: '100%', padding: 12, fontSize: 14, borderRadius: 4,
              border: '1px solid ' + HAIR, color: INK, background: WHITE,
              fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, alignItems: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Length</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {LENGTH_CHOICES.map(l => (
                <button key={l.v} onClick={() => setLength(l.v)} style={chip(length === l.v)}>{l.label}</button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Style</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STYLE_CHOICES.map(s => (
                <button key={s.v} onClick={() => setStyle(s.v)} title={s.hint} style={chip(style === s.v)}>{s.label}</button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Channel</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CHANNEL_CHOICES.map(c => (
                <button key={c.v} onClick={() => setChannel(c.v)} style={chip(channel === c.v)}>{c.label}</button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Voice</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['none','openai_tts','upload'] as VoiceMode[]).map(m => (
                <button key={m} onClick={() => setVoiceMode(m)} style={chip(voiceMode === m)}>
                  {m === 'none' ? 'None' : m === 'openai_tts' ? 'OpenAI TTS' : 'Upload MP3'}
                </button>
              ))}
              {voiceMode === 'openai_tts' && (
                <select value={voice} onChange={e => setVoice(e.target.value as Voice)}
                  style={{ padding: '4px 8px', fontSize: 11, border: '1px solid ' + HAIR, borderRadius: 3, background: WHITE, color: INK }}>
                  {VOICE_CHOICES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
            </div>

            <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Music</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {MOOD_CHOICES.map(m => (
                <button key={m} onClick={() => setMusicMood(m)} style={chip(musicMood === m)}>
                  {m === 'none' ? 'None' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Areas</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Rooms','F&B','Wellness','River','Recreation'].map(a => (
                <button key={a} onClick={() => setAreas(v => ({ ...v, [a]: !v[a] }))} style={chip(!!areas[a])}>
                  {areas[a] ? '✓ ' : ''}{a}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Title</div>
            <input value={title} onChange={e => setTitle(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 12, border: '1px solid ' + HAIR, borderRadius: 3, color: INK, background: WHITE }} />

            <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Tagline</div>
            <input value={tagline} onChange={e => setTagline(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 12, border: '1px solid ' + HAIR, borderRadius: 3, color: INK, background: WHITE }} />
          </div>

          <button onClick={designVideo} disabled={busy || !prompt.trim()} style={{
            marginTop: 20, padding: '10px 24px', fontSize: 13, fontWeight: 700,
            background: busy ? INK_M : FOREST, color: WHITE, border: 'none', borderRadius: 4,
            cursor: busy ? 'progress' : 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>{busy ? 'Designing…' : '✦ Design Video'}</button>
        </div>
      ) : (
        // ── PREVIEW VIEW ──────────────────────────────────────────
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={resetDesign} style={{
              padding: '6px 12px', fontSize: 11, background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer',
            }}>← New prompt</button>
            <div style={{ fontSize: 12, color: INK_M }}>
              AI cut · {result.shots.length} shots · ~{Math.round(result.total_duration_sec)}s · {style}
            </div>
          </div>

          {/* Shot strip */}
          <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, fontWeight: 700, marginBottom: 10 }}>
              Selected shots
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {result.shots.map((s, i) => (
                <div key={s.asset_id} style={{ border: '1px solid ' + HAIR, borderRadius: 4, overflow: 'hidden', background: WHITE }}>
                  <div style={{ position: 'relative', aspectRatio: '16/9', background: CREAM }}>
                    {s.public_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.public_url} alt={s.asset_id} loading='lazy'
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                    <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.72)', color: WHITE, fontSize: 10, padding: '2px 6px', borderRadius: 2, fontWeight: 700 }}>#{i + 1}</div>
                  </div>
                  <div style={{ padding: '6px 8px', fontSize: 10, color: INK_M }}>
                    <div style={{ color: INK, fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{s.area ?? 'no area'}</div>
                    <div style={{ marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{s.tier ?? ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Script + music */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 16 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, fontWeight: 700, marginBottom: 6 }}>Voiceover script</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: INK }}>
                {result.script || <span style={{ color: INK_M, fontStyle: 'italic' }}>No script generated</span>}
              </div>
            </div>
            <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 16 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, fontWeight: 700, marginBottom: 6 }}>Music</div>
              {result.music ? (
                <div style={{ fontSize: 12, color: INK }}>
                  <div style={{ fontWeight: 700 }}>{result.music.title}</div>
                  <div style={{ color: INK_M, marginTop: 2 }}>{result.music.artist ?? 'Unknown'} · {result.music.source}</div>
                  <audio controls src={result.music.url} style={{ marginTop: 8, width: '100%' }} />
                </div>
              ) : <div style={{ fontSize: 12, color: INK_M }}>No music selected</div>}
            </div>
          </div>

          {/* Thumbnails */}
          {result.thumbnails.length > 0 && (
            <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, fontWeight: 700, marginBottom: 10 }}>
                Per-channel thumbnails
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {result.thumbnails.map(t => (
                  <div key={t.channel} style={{ border: '1px solid ' + HAIR, borderRadius: 4, overflow: 'hidden', background: WHITE }}>
                    <div style={{ position: 'relative', background: CREAM, height: 120 }}>
                      {t.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.url} alt={t.channel} loading='lazy'
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ padding: 10, fontSize: 11, color: INK_M }}>generation failed</div>
                      )}
                    </div>
                    <div style={{ padding: '6px 8px', fontSize: 10 }}>
                      <div style={{ color: INK, fontWeight: 600 }}>{t.display_name}</div>
                      <div style={{ color: INK_M, marginTop: 1 }}>{t.width}×{t.height}</div>
                      {t.url && (
                        <a href={t.url} download style={{ display: 'inline-block', marginTop: 4, fontSize: 10, color: FOREST, fontWeight: 600 }}>Download</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={renderFull} disabled={rendering} style={{
            padding: '12px 28px', fontSize: 13, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', background: rendering ? INK_M : FOREST, color: WHITE,
            border: 'none', borderRadius: 4, cursor: rendering ? 'progress' : 'pointer',
          }}>{rendering ? 'Dispatching…' : '🎬 Render Full Video'}</button>
        </div>
      )}

      {/* Render queue below */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, fontWeight: 700, marginBottom: 8 }}>
          Recent renders ({rows.length})
        </div>
        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: CREAM, borderBottom: '1px solid ' + HAIR }}>
                <th style={{ padding: 8, textAlign: 'left', color: INK_M, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title</th>
                <th style={{ padding: 8, textAlign: 'left', color: INK_M, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Channel</th>
                <th style={{ padding: 8, textAlign: 'left', color: INK_M, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                <th style={{ padding: 8, textAlign: 'left', color: INK_M, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Created</th>
                <th style={{ padding: 8, textAlign: 'left', color: INK_M, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Error / Output</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid ' + HAIR }}>
                  <td style={{ padding: 8, color: INK }}>{r.title ?? r.id.slice(0, 8)}</td>
                  <td style={{ padding: 8, color: INK_M }}>{r.channel}</td>
                  <td style={{ padding: 8 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                      background: r.status === 'done' ? '#E5F3EC' : r.status === 'failed' ? '#FCE9E5' : '#FBF3DC',
                      color: r.status === 'done' ? FOREST : r.status === 'failed' ? RED : '#B48A3A',
                    }}>{r.status}</span>
                  </td>
                  <td style={{ padding: 8, color: INK_M }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={{ padding: 8, color: r.status === 'failed' ? RED : INK_M, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.error_msg ?? ''}>
                    {r.error_msg ?? (r.output_asset_id ? 'asset ' + r.output_asset_id.slice(0, 8) : '—')}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: INK_M, fontStyle: 'italic' }}>No renders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  function chip(active: boolean): React.CSSProperties {
    return {
      padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 3,
      border: '1px solid ' + (active ? FOREST : HAIR),
      background: active ? FOREST : WHITE,
      color: active ? WHITE : INK,
      cursor: 'pointer', whiteSpace: 'nowrap',
    };
  }
}
