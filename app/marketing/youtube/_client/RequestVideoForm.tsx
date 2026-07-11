'use client';
// app/marketing/youtube/_client/RequestVideoForm.tsx
// PBS 2026-07-11 pm — client form so we can toggle talking-head panel + show submitting state.
// Posts JSON to /api/marketing/youtube/request-video and reloads on success.

import { useState, useTransition } from 'react';

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_S = '#3A3A3A';
const FOREST = '#084838';

interface Brief {
  brief_id: string;
  generated_at_utc: string | null;
}
interface Person {
  id: number;
  full_name: string;
}

interface Props {
  propertyId: number;
  briefs: Brief[];
  approvedPeople: Person[];
}

const STYLES: Array<{ v: string; label: string }> = [
  { v: 'reel',            label: 'Reel (vertical, 30-60s)' },
  { v: 'short',           label: 'YouTube Short (vertical, <=60s)' },
  { v: 'long_form',       label: 'Long-form (horizontal, 3-10 min)' },
  { v: 'testimonial',     label: 'Testimonial (guest talking head)' },
  { v: 'retreat_program', label: 'Retreat programme walk-through' },
  { v: 'room_tour',       label: 'Room tour' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${HAIR}`, borderRadius: 3,
  background: WHITE, color: INK, fontSize: 13, fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em',
  color: INK_S, marginBottom: 6, fontWeight: 500,
};

export default function RequestVideoForm({ propertyId, briefs, approvedPeople }: Props) {
  const [style, setStyle] = useState('reel');
  const [voice, setVoice] = useState<'house' | 'talking_head'>('house');
  const [personId, setPersonId] = useState<string>('');
  const [angle, setAngle] = useState('');
  const [duration, setDuration] = useState('45');
  const [cta, setCta] = useState('');
  const [assets, setAssets] = useState('');
  const [notes, setNotes] = useState('');
  const [briefId, setBriefId] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!angle.trim()) { setMsg({ kind: 'err', text: 'Angle is required' }); return; }
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/marketing/youtube/request-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id:            propertyId,
            angle,
            style,
            duration_seconds:       Number(duration) || 45,
            voice,
            talking_head_person_id: voice === 'talking_head' && personId ? Number(personId) : null,
            cta,
            source_asset_urls:      assets,
            notes,
            linked_brief_id:        briefId || null,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j.ok === false) {
          setMsg({ kind: 'err', text: `Failed: ${j.error ?? res.statusText}` });
          return;
        }
        setMsg({ kind: 'ok', text: `Request queued for Lumen · ticket #${j.ticket_id ?? '—'} · request ${String(j.request_id ?? '').slice(0, 8)}` });
        setAngle(''); setCta(''); setAssets(''); setNotes(''); setBriefId('');
      } catch (err) {
        setMsg({ kind: 'err', text: `Network error: ${(err as Error).message}` });
      }
    });
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <div>
        <label style={labelStyle} htmlFor="yt-angle">Angle · what should the video be about?</label>
        <textarea id="yt-angle" required rows={2} value={angle} onChange={(e) => setAngle(e.target.value)}
          placeholder="e.g. Slow morning on the Mekong · art suite balcony ritual"
          style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="yt-style">Style</label>
          <select id="yt-style" value={style} onChange={(e) => setStyle(e.target.value)} style={inputStyle}>
            {STYLES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="yt-duration">Duration (seconds)</label>
          <input id="yt-duration" type="number" min={5} max={900} value={duration}
            onChange={(e) => setDuration(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Voice</label>
          <div style={{ display: 'flex', gap: 14, paddingTop: 6, fontSize: 13, color: INK }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="radio" name="voice" checked={voice === 'house'} onChange={() => setVoice('house')} /> House
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="radio" name="voice" checked={voice === 'talking_head'} onChange={() => setVoice('talking_head')} /> Talking head
            </label>
          </div>
        </div>
      </div>

      {voice === 'talking_head' && (
        <div>
          <label style={labelStyle} htmlFor="yt-person">Approved person</label>
          {approvedPeople.length === 0 ? (
            <div style={{ ...inputStyle, color: INK_M, background: '#FBF3E0' }}>
              No approved people on file. Add one under Guardrails &rarr; Approved people (requires model-release doc).
            </div>
          ) : (
            <select id="yt-person" value={personId} onChange={(e) => setPersonId(e.target.value)} style={inputStyle}>
              <option value="">Select approved person&hellip;</option>
              {approvedPeople.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          )}
        </div>
      )}

      <div>
        <label style={labelStyle} htmlFor="yt-cta">Call to action (optional)</label>
        <input id="yt-cta" value={cta} onChange={(e) => setCta(e.target.value)}
          placeholder="e.g. Book direct on namkhan-retreat.com" style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle} htmlFor="yt-assets">Source assets · one URL per line (optional)</label>
        <textarea id="yt-assets" rows={3} value={assets} onChange={(e) => setAssets(e.target.value)}
          placeholder="https://... (drone shot)&#10;https://... (reception clip)"
          style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, resize: 'vertical' }} />
      </div>

      <div>
        <label style={labelStyle} htmlFor="yt-brief">Link to trend brief (optional)</label>
        <select id="yt-brief" value={briefId} onChange={(e) => setBriefId(e.target.value)} style={inputStyle}>
          <option value="">None</option>
          {briefs.map((b) => (
            <option key={b.brief_id} value={b.brief_id}>
              {(b.generated_at_utc ?? '').slice(0, 10)} &middot; {b.brief_id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle} htmlFor="yt-notes">Notes for Lumen (optional)</label>
        <textarea id="yt-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
          style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button type="submit" disabled={isPending}
          style={{
            padding: '10px 18px', border: `1px solid ${FOREST}`, borderRadius: 3,
            background: FOREST, color: WHITE, fontSize: 13, letterSpacing: '.04em',
            textTransform: 'uppercase', cursor: isPending ? 'wait' : 'pointer', fontWeight: 500,
          }}>
          {isPending ? 'Sending&hellip;' : 'Send to Lumen'}
        </button>
        {msg && (
          <span style={{ fontSize: 13, color: msg.kind === 'ok' ? FOREST : '#B03826' }}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
