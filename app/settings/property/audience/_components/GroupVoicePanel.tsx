'use client';
// app/settings/property/audience/_components/GroupVoicePanel.tsx
// PBS 2026-07-22 · Per-group voice profile · read by the AI proposer.
// Each group has a voice_type (b2c / b2b / mixed) + a voice_summary paragraph
// injected into the Claude system prompt so tone/positioning match the audience.

import { useState, useTransition } from 'react';
import type { CSSProperties } from 'react';

export interface VoiceGroupRow {
  slug: string;
  name: string;
  color: string | null;
  voice_type: 'b2c' | 'b2b' | 'mixed' | null;
  voice_summary: string | null;
}

interface Props {
  groups: VoiceGroupRow[];
}

const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';
const BRAND = '#084838';
const RED   = '#B03826';

export default function GroupVoicePanel({ groups: initial }: Props) {
  const [rows, setRows] = useState<VoiceGroupRow[]>(() =>
    [...initial].sort((a, b) => {
      // B2C first, then B2B, then mixed. Within each, alphabetical.
      const rank = (v: string | null) => v==='b2c'?0 : v==='b2b'?1 : 2;
      const r = rank(a.voice_type) - rank(b.voice_type);
      return r !== 0 ? r : a.name.localeCompare(b.name);
    })
  );
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ voice_type: 'b2c'|'b2b'|'mixed'; voice_summary: string } | null>(null);
  const [msg, setMsg]   = useState<string | null>(null);
  const [busy, startT]  = useTransition();

  function openEdit(g: VoiceGroupRow) {
    setOpenSlug(g.slug);
    setDraft({
      voice_type: (g.voice_type ?? 'b2c') as 'b2c'|'b2b'|'mixed',
      voice_summary: g.voice_summary ?? '',
    });
  }
  function closeEdit() { setOpenSlug(null); setDraft(null); }

  function save() {
    if (!openSlug || !draft) return;
    const slug = openSlug;
    startT(async () => {
      const r = await fetch('/api/marketing/audience/group-voice-save', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, voice_type: draft.voice_type, voice_summary: draft.voice_summary }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg('Save failed: ' + (j?.error ?? r.status)); return; }
      setRows(prev => prev.map(x => x.slug===slug ? { ...x, voice_type: draft.voice_type, voice_summary: draft.voice_summary } : x));
      setMsg('Voice saved.');
      setTimeout(() => setMsg(null), 1600);
      closeEdit();
    });
  }

  return (
    <section style={panel}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
        <div>
          <div style={h3}>Group voice · how the AI writes to each audience</div>
          <div style={muted}>
            Read by the newsletter proposer. Pick a voice type (B2C / B2B / mixed) and write a short paragraph explaining who this audience is + what tone works.
          </div>
        </div>
        <div style={{ fontSize:11, color:INK_S }}>{rows.length} group{rows.length === 1 ? '' : 's'}</div>
      </div>

      {msg && (
        <div style={{
          padding:8, fontSize:12,
          background: msg.includes('failed') ? '#FBE8E4' : '#EEF6EE',
          color: msg.includes('failed') ? RED : '#1F5C2C',
          border: `1px solid ${msg.includes('failed') ? RED : '#C9E1C9'}`,
          borderRadius:3, marginBottom:8,
        }}>{msg}</div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {rows.map(g => {
          const open = openSlug === g.slug;
          return (
            <div key={g.slug} style={{ border:`1px solid ${HAIR}`, borderRadius:4, background:'#FFFFFF' }}>
              <button type="button" onClick={() => open ? closeEdit() : openEdit(g)}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'transparent', border:'none', textAlign:'left', cursor:'pointer', fontFamily:'inherit' }}>
                <span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background: g.color ?? '#7A4B2A', border:`1px solid ${HAIR}` }} />
                <span style={{ fontSize:12, fontWeight:600, color:INK, minWidth:200 }}>{g.name}</span>
                <span style={{
                  padding:'2px 8px', fontSize:10, fontWeight:600, borderRadius:10,
                  background: g.voice_type==='b2b' ? '#E4EAF1' : g.voice_type==='mixed' ? '#F5F0E1' : '#EEF6EE',
                  color:    g.voice_type==='b2b' ? '#1F3A5C' : g.voice_type==='mixed' ? '#8B5A1C' : '#1F5C2C',
                  border:  `1px solid ${g.voice_type==='b2b' ? '#A0B4CF' : g.voice_type==='mixed' ? '#E8C89B' : '#C9E1C9'}`,
                }}>{g.voice_type ?? 'b2c'}</span>
                <span style={{ fontSize:11, color:INK_S, flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {g.voice_summary ? g.voice_summary : 'No voice set — using default.'}
                </span>
                <span style={{ fontSize:11, color:BRAND, fontWeight:600 }}>{open ? 'Close' : 'Edit'}</span>
              </button>

              {open && draft && (
                <div style={{ padding:'0 10px 12px', borderTop:`1px dashed ${HAIR}` }}>
                  <div style={{ display:'flex', gap:12, marginTop:10 }}>
                    <label style={fieldLabel}>Voice type</label>
                    <select value={draft.voice_type}
                      onChange={e => setDraft(d => d && ({ ...d, voice_type: e.target.value as 'b2c'|'b2b'|'mixed' }))}
                      style={inputStyle}>
                      <option value="b2c">b2c — leisure travellers, guests, personal</option>
                      <option value="b2b">b2b — partners, DMCs, hotels, commercial</option>
                      <option value="mixed">mixed — context-dependent</option>
                    </select>
                  </div>
                  <label style={{ display:'block', marginTop:10 }}>
                    <span style={fieldLabel}>Voice summary (used by the AI)</span>
                    <textarea value={draft.voice_summary}
                      onChange={e => setDraft(d => d && ({ ...d, voice_summary: e.target.value }))}
                      rows={4} maxLength={2000}
                      placeholder="Who is this audience and how should the AI speak to them?"
                      style={{ ...inputStyle, width:'100%', fontFamily:'inherit', boxSizing:'border-box', marginTop:4 }}
                    />
                    <div style={{ fontSize:10, color:INK_S, marginTop:4 }}>
                      {draft.voice_summary.length} / 2000 chars
                    </div>
                  </label>
                  <div style={{ display:'flex', gap:8, marginTop:10, justifyContent:'flex-end' }}>
                    <button type="button" onClick={closeEdit} disabled={busy}
                      style={btnSecondary}>Cancel</button>
                    <button type="button" onClick={save} disabled={busy}
                      style={btnPrimary}>{busy ? 'Saving…' : 'Save voice'}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const panel: CSSProperties = { border: `1px solid ${HAIR}`, borderRadius: 6, background: '#FFFFFF', padding: 16 };
const h3:    CSSProperties = { margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: INK };
const muted: CSSProperties = { margin: '0 0 12px', fontSize: 11, color: INK_S };
const fieldLabel: CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, fontWeight: 600 };
const inputStyle: CSSProperties = { border: `1px solid ${HAIR}`, borderRadius: 4, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit' };
const btnPrimary:   CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 600, background: BRAND, color: '#FFFFFF', border: `1px solid ${BRAND}`, borderRadius: 4, cursor: 'pointer' };
const btnSecondary: CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 600, background: '#FFFFFF', color: BRAND, border: `1px solid ${HAIR}`, borderRadius: 4, cursor: 'pointer' };
