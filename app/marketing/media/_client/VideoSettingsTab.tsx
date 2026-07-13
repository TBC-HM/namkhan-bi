// app/marketing/media/_client/VideoSettingsTab.tsx
// PBS 2026-07-13 · Video AI Studio v1 — settings tab.
// Sections: Style presets · Music library · Voice preferences · Brand overlay.
// Data loaded via /api/marketing/media/video-settings-data (also proxies
// searchMusic for the library grid).
'use client';

import { useEffect, useState } from 'react';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';

interface StylePreset {
  id: string; property_id: number | null; channel: string; preset_key: string;
  playlist_id: string | null; opener_config: any; closer_config: any;
  music_mood: string | null; voice_id: string | null;
  transition_style: string | null; avg_shot_duration_sec: number | null;
  active: boolean;
}
interface MusicTrack {
  id: string; source: string; title: string; artist: string | null;
  duration_sec: number | null; mood_tags: string[]; url: string; license_terms: string | null;
}
interface Props {
  propertyId: number;
  presets: StylePreset[];
  musicTracks: MusicTrack[];
}

const VOICE_CHOICES = ['alloy','echo','fable','onyx','nova','shimmer'] as const;
const MOOD_CHOICES  = ['ambient','upbeat','emotional','cinematic','uplifting','casual'] as const;
const CHANNEL_CHOICES = ['youtube_16_9','youtube_shorts_9_16','instagram_reels','tiktok','facebook','website_hero'] as const;

export default function VideoSettingsTab({ propertyId, presets, musicTracks }: Props) {
  const [section, setSection] = useState<'presets'|'music'|'voice'|'brand'|'guardrails'>('presets');
  const [defaultVoice, setDefaultVoice] = useState<string>('nova');
  const [banner, setBanner] = useState<string | null>(null);
  const [testingVoice, setTestingVoice] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [presetRows, setPresetRows] = useState<StylePreset[]>(presets);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>(musicTracks);
  const [moodFilter, setMoodFilter] = useState<string>('');

  const filteredTracks = moodFilter
    ? tracks.filter(t => (t.mood_tags ?? []).some(m => m.toLowerCase().includes(moodFilter.toLowerCase())))
    : tracks;

  async function testVoice() {
    setTestingVoice(true); setBanner(null);
    try {
      const res = await fetch('/api/marketing/media/video-thumbnails-preview', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        // Reuse endpoint as a preview stub — swap for /api/marketing/media/tts-preview if built.
        body: JSON.stringify({ asset_id: 'test' }),
      });
      // No-op preview path for now.
      setBanner('Voice preview endpoint not yet wired · falling back to /api/marketing/media/video-design flow');
    } catch (e: any) {
      setBanner('Voice test failed: ' + (e?.message ?? 'unknown'));
    } finally { setTestingVoice(false); }
  }

  async function updatePreset(p: StylePreset) {
    setBanner(null);
    try {
      const res = await fetch('/api/marketing/media/video-preset-upsert', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(p),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error ?? 'unknown');
      setPresetRows(prev => prev.map(x => x.id === p.id ? { ...x, ...(j.row ?? p) } : x));
      setEditingId(null);
      setBanner('Preset saved');
    } catch (e: any) { setBanner('Save failed: ' + (e?.message ?? 'unknown')); }
  }

  return (
    <div>
      {banner && (
        <div style={{ padding: '8px 12px', marginBottom: 12, background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4, fontSize: 12, color: INK }}>
          {banner}
          <button onClick={() => setBanner(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: INK_M }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid ' + HAIR }}>
        {(['presets','music','voice','brand','guardrails'] as const).map(k => (
          <button key={k} onClick={() => setSection(k)} style={{
            padding: '8px 14px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
            border: 'none', background: 'transparent',
            color: section === k ? FOREST : INK_M,
            borderBottom: section === k ? '2px solid ' + FOREST : '2px solid transparent',
            fontWeight: section === k ? 700 : 500, cursor: 'pointer',
          }}>{k === 'presets' ? 'Style presets' : k === 'music' ? 'Music library' : k === 'voice' ? 'Voice' : k === 'brand' ? 'Brand overlays' : 'Guardrails'}</button>
        ))}
      </div>

      {section === 'presets' && (
        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: CREAM, borderBottom: '1px solid ' + HAIR }}>
                <th style={{ padding: 10, textAlign: 'left', color: INK_M, fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>Channel</th>
                <th style={{ padding: 10, textAlign: 'left', color: INK_M, fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>Preset</th>
                <th style={{ padding: 10, textAlign: 'left', color: INK_M, fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>Opener</th>
                <th style={{ padding: 10, textAlign: 'left', color: INK_M, fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>Closer</th>
                <th style={{ padding: 10, textAlign: 'left', color: INK_M, fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>Music</th>
                <th style={{ padding: 10, textAlign: 'left', color: INK_M, fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>Voice</th>
                <th style={{ padding: 10, textAlign: 'left', color: INK_M, fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>Avg shot</th>
                <th style={{ padding: 10 }}></th>
              </tr>
            </thead>
            <tbody>
              {presetRows.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid ' + HAIR }}>
                  <td style={{ padding: 10, color: INK, fontWeight: 600 }}>{p.channel}</td>
                  <td style={{ padding: 10, color: INK }}>{p.preset_key}</td>
                  <td style={{ padding: 10, color: INK_M, fontSize: 11 }}>{p.opener_config?.tagline ?? '—'} · {p.opener_config?.duration_sec ?? '?'}s</td>
                  <td style={{ padding: 10, color: INK_M, fontSize: 11 }}>{p.closer_config?.tagline ?? '—'} · {p.closer_config?.duration_sec ?? '?'}s</td>
                  <td style={{ padding: 10, color: INK_M }}>{p.music_mood ?? '—'}</td>
                  <td style={{ padding: 10, color: INK_M }}>{p.voice_id ?? '—'}</td>
                  <td style={{ padding: 10, color: INK_M }}>{p.avg_shot_duration_sec ?? '—'}s</td>
                  <td style={{ padding: 10 }}>
                    <button onClick={() => setEditingId(editingId === p.id ? null : p.id)} style={{
                      padding: '4px 10px', fontSize: 10, background: WHITE, border: '1px solid ' + INK, color: INK, borderRadius: 2, cursor: 'pointer',
                    }}>{editingId === p.id ? 'Close' : 'Edit'}</button>
                  </td>
                </tr>
              ))}
              {presetRows.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: INK_M, fontStyle: 'italic' }}>No style presets seeded</td></tr>
              )}
            </tbody>
          </table>
          {editingId && (() => {
            const p = presetRows.find(x => x.id === editingId);
            if (!p) return null;
            return (
              <div style={{ padding: 16, background: CREAM, borderTop: '1px solid ' + HAIR }}>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, alignItems: 'center' }}>
                  <label style={{ fontSize: 11, color: INK_M }}>Opener tagline</label>
                  <input value={p.opener_config?.tagline ?? ''} onChange={e => setPresetRows(prev => prev.map(x => x.id === p.id ? { ...x, opener_config: { ...x.opener_config, tagline: e.target.value } } : x))}
                    style={{ padding: '6px 10px', fontSize: 12, border: '1px solid ' + HAIR, borderRadius: 3, background: WHITE, color: INK }} />
                  <label style={{ fontSize: 11, color: INK_M }}>Closer tagline</label>
                  <input value={p.closer_config?.tagline ?? ''} onChange={e => setPresetRows(prev => prev.map(x => x.id === p.id ? { ...x, closer_config: { ...x.closer_config, tagline: e.target.value } } : x))}
                    style={{ padding: '6px 10px', fontSize: 12, border: '1px solid ' + HAIR, borderRadius: 3, background: WHITE, color: INK }} />
                  <label style={{ fontSize: 11, color: INK_M }}>Music mood</label>
                  <select value={p.music_mood ?? ''} onChange={e => setPresetRows(prev => prev.map(x => x.id === p.id ? { ...x, music_mood: e.target.value } : x))}
                    style={{ padding: '6px 10px', fontSize: 12, border: '1px solid ' + HAIR, borderRadius: 3, background: WHITE, color: INK }}>
                    <option value=''>—</option>
                    {MOOD_CHOICES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <label style={{ fontSize: 11, color: INK_M }}>Voice</label>
                  <select value={p.voice_id ?? ''} onChange={e => setPresetRows(prev => prev.map(x => x.id === p.id ? { ...x, voice_id: e.target.value } : x))}
                    style={{ padding: '6px 10px', fontSize: 12, border: '1px solid ' + HAIR, borderRadius: 3, background: WHITE, color: INK }}>
                    <option value=''>—</option>
                    {VOICE_CHOICES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <label style={{ fontSize: 11, color: INK_M }}>Avg shot (sec)</label>
                  <input type='number' step='0.5' value={p.avg_shot_duration_sec ?? 3.5}
                    onChange={e => setPresetRows(prev => prev.map(x => x.id === p.id ? { ...x, avg_shot_duration_sec: Number(e.target.value) } : x))}
                    style={{ padding: '6px 10px', fontSize: 12, border: '1px solid ' + HAIR, borderRadius: 3, background: WHITE, color: INK }} />
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button onClick={() => updatePreset(p)} style={{
                    padding: '6px 16px', fontSize: 12, fontWeight: 700, background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer',
                  }}>Save</button>
                  <button onClick={() => setEditingId(null)} style={{
                    padding: '6px 16px', fontSize: 12, background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer',
                  }}>Cancel</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {section === 'music' && (
        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Filter mood</div>
            <input value={moodFilter} onChange={e => setMoodFilter(e.target.value)} placeholder='ambient, cinematic…'
              style={{ padding: '4px 10px', fontSize: 11, border: '1px solid ' + HAIR, borderRadius: 3, background: WHITE, color: INK, minWidth: 180 }} />
            <div style={{ fontSize: 11, color: INK_M, marginLeft: 'auto' }}>{filteredTracks.length} tracks</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {filteredTracks.map(t => (
              <div key={t.id} style={{ border: '1px solid ' + HAIR, borderRadius: 4, padding: 10, background: WHITE }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{t.title}</div>
                <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>{t.artist ?? '—'} · {t.duration_sec ?? '?'}s · {t.source}</div>
                <div style={{ fontSize: 10, color: INK_M, marginTop: 4 }}>{(t.mood_tags ?? []).join(' · ')}</div>
                <audio controls src={t.url} style={{ width: '100%', marginTop: 6 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'voice' && (
        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, fontWeight: 700, marginBottom: 12 }}>OpenAI TTS voice preferences</div>
          <p style={{ fontSize: 12, color: INK, lineHeight: 1.5, marginBottom: 12 }}>
            OpenAI Text-to-Speech is used (Google Cloud TTS blocked by org policy). Cost: ~$15 per 1M characters.
            Vault key resolution order: <code>OPENAI_TTS_API_KEY</code> → <code>OPENAI_IMAGE_KEY</code> → <code>OPENAI_API_KEY</code>.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {VOICE_CHOICES.map(v => (
              <button key={v} onClick={() => setDefaultVoice(v)} style={{
                padding: '10px 14px', fontSize: 12, fontWeight: defaultVoice === v ? 700 : 500,
                background: defaultVoice === v ? FOREST : WHITE, color: defaultVoice === v ? WHITE : INK,
                border: '1px solid ' + (defaultVoice === v ? FOREST : HAIR), borderRadius: 3, cursor: 'pointer',
              }}>{v}</button>
            ))}
          </div>
          <button onClick={testVoice} disabled={testingVoice} style={{
            marginTop: 16, padding: '8px 18px', fontSize: 12, fontWeight: 700,
            background: WHITE, border: '1px solid ' + INK, color: INK, borderRadius: 3, cursor: 'pointer',
          }}>{testingVoice ? 'Testing…' : 'Preview voice'}</button>
          {audioUrl && <audio src={audioUrl} controls style={{ display: 'block', marginTop: 12 }} />}
        </div>
      )}

      {section === 'brand' && (
        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, fontWeight: 700, marginBottom: 12 }}>Brand overlay</div>
          <p style={{ fontSize: 12, color: INK, lineHeight: 1.5 }}>
            Opener/closer overlays draw brand colour + tagline from each style preset above.
            Contact strip (thenamkhan.com · @thenamkhan · stay@thenamkhan.com) is inlined in
            <code>lib/video/shotstackBuilder.buildCloserLayers()</code>. Edit each preset row to change per-channel wording.
          </p>
          <p style={{ fontSize: 12, color: INK_M, lineHeight: 1.5, marginTop: 10 }}>
            Property-level brand assets live in <code>marketing.brand_assets</code> and the Property Settings · Brand & Reality
            page. Video pipeline reads primary_color + logo_url from there when preset config omits them.
          </p>
        </div>
      )}

      {section === 'guardrails' && (
        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, fontWeight: 700, marginBottom: 12 }}>Video guardrails</div>
          <ul style={{ fontSize: 12, color: INK, lineHeight: 1.7, paddingLeft: 20 }}>
            <li>Quality threshold: <code>quality_index &gt;= 60</code> (falls back to 40 if too few matches)</li>
            <li>Banned terms + approved people managed under top-level Settings · Guardrails</li>
            <li>Competitor blacklist read from <code>marketing.compliance_rules</code></li>
            <li>Max render cost cap: €5 per edit (Shotstack HD, ~30s → ~€1)</li>
          </ul>
        </div>
      )}
    </div>
  );
}
