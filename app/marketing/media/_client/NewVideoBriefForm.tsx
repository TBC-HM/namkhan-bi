// app/marketing/media/_client/NewVideoBriefForm.tsx
// PBS 2026-07-13 · Phase 2 unified video pipeline — new brief entry form.
// Client component. Renders inside VideoHub as the "+ New brief" affordance.
// Submits to POST /api/marketing/media/video-brief-create (SECURITY DEFINER RPC).
'use client';

import { useState } from 'react';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const AMBER  = '#B48A3A';
const RED    = '#B03826';

const CHANNELS: Array<{ key: string; label: string }> = [
  { key: 'youtube',   label: 'YouTube (16:9)' },
  { key: 'instagram', label: 'Instagram (9:16)' },
  { key: 'tiktok',    label: 'TikTok (9:16)' },
  { key: 'facebook',  label: 'Facebook (16:9 + 1:1)' },
  { key: 'wechat',    label: 'WeChat (9:16)' },
];

export interface PillarOption {
  pillar_key: string;
  label: string;
}

interface Props {
  propertyId: number;
  pillars: PillarOption[];
  onCreated?: () => void;
  onCancel?: () => void;
}

export default function NewVideoBriefForm({ propertyId, pillars, onCreated, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [angle, setAngle] = useState('');
  const [channels, setChannels] = useState<Record<string, boolean>>({ youtube: true });
  const [selectedPillars, setSelectedPillars] = useState<Record<string, boolean>>({});
  const [durationSec, setDurationSec] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleChannel(k: string) {
    setChannels(s => ({ ...s, [k]: !s[k] }));
  }

  function togglePillar(k: string) {
    setSelectedPillars(s => ({ ...s, [k]: !s[k] }));
  }

  const pickedChannels = Object.entries(channels).filter(([_, v]) => v).map(([k]) => k);
  const pickedPillars  = Object.entries(selectedPillars).filter(([_, v]) => v).map(([k]) => k);

  async function submit() {
    setErr(null);
    if (!title.trim()) { setErr('Title required'); return; }
    if (pickedChannels.length === 0) { setErr('Pick at least one channel'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/marketing/media/video-brief-create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          title: title.trim(),
          angle: angle.trim() || null,
          target_channels: pickedChannels,
          target_pillars: pickedPillars.length ? pickedPillars : null,
          duration_target_sec: durationSec ? Number(durationSec) : null,
          notes: notes.trim() || null,
          origin: 'manual_media_studio',
        }),
      });
      const jr = await res.json().catch(() => null);
      if (!res.ok || !jr?.ok) {
        setErr(jr?.detail || jr?.error || `HTTP ${res.status}`);
        setSaving(false);
        return;
      }
      // Reset + notify parent to re-fetch.
      setTitle(''); setAngle(''); setChannels({ youtube: true }); setSelectedPillars({});
      setDurationSec(''); setNotes('');
      setSaving(false);
      if (onCreated) onCreated();
    } catch (e: any) {
      setErr(e?.message ?? 'unknown_error');
      setSaving(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: INK_M, fontWeight: 700, marginBottom: 6, display: 'block',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: `1px solid ${HAIR}`,
    borderRadius: 4, fontSize: 13, color: INK, background: WHITE,
    boxSizing: 'border-box',
  };
  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 10px', border: `1px solid ${active ? FOREST : HAIR}`,
    background: active ? FOREST : WHITE, color: active ? WHITE : INK,
    borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: active ? 600 : 500,
  });

  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 4 }}>New video brief</div>
      <div style={{ fontSize: 11, color: INK_M, marginBottom: 16 }}>
        origin = manual_media_studio · property {propertyId}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Title *</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
               style={inputStyle} placeholder="e.g. Boat cruise at golden hour" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Angle / hook</label>
        <textarea value={angle} onChange={e => setAngle(e.target.value)}
                  rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="What is this video about? One paragraph." />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Target channels *</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CHANNELS.map(c => (
            <button key={c.key} type="button" onClick={() => toggleChannel(c.key)}
                    style={chipStyle(!!channels[c.key])}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {pillars.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Target pillars</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pillars.map(p => (
              <button key={p.pillar_key} type="button" onClick={() => togglePillar(p.pillar_key)}
                      style={chipStyle(!!selectedPillars[p.pillar_key])}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Duration target (sec)</label>
          <input type="number" min={5} max={900} value={durationSec}
                 onChange={e => setDurationSec(e.target.value)}
                 style={inputStyle} placeholder="e.g. 45" />
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)}
                 style={inputStyle} placeholder="Anything the editor / AI should know" />
        </div>
      </div>

      {err && (
        <div style={{ background: CREAM, border: `1px solid ${AMBER}`, color: RED,
                      padding: '8px 12px', borderRadius: 4, fontSize: 12, marginBottom: 12 }}>
          {err}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving}
                  style={{ padding: '8px 14px', border: `1px solid ${HAIR}`, background: WHITE,
                           color: INK_M, borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
        )}
        <button type="button" onClick={submit} disabled={saving}
                style={{ padding: '8px 16px', border: 'none', background: FOREST,
                         color: WHITE, borderRadius: 4, fontSize: 12, fontWeight: 700,
                         cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Creating...' : 'Create brief'}
        </button>
      </div>
    </div>
  );
}
