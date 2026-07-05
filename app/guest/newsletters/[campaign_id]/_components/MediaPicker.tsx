// app/guest/newsletters/[campaign_id]/_components/MediaPicker.tsx
// PBS 2026-07-05: modal grid of branding-bucket photos. Click to insert into body_md.
'use client';

import { useEffect, useMemo, useState } from 'react';

interface MediaRow { path: string; url: string; category: string; filename: string; }

interface Props { onPick: (url: string, filename: string) => void; onClose: () => void; }

export default function MediaPicker({ onPick, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');

  useEffect(() => {
    fetch('/api/newsletter/media-list').then((r) => r.json()).then((j) => {
      setLoading(false);
      if (j?.ok) setMedia(j.media as MediaRow[]);
    }).catch(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const s = new Set<string>(); for (const m of media) s.add(m.category); return Array.from(s).sort();
  }, [media]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return media.filter((m) => {
      if (cat && m.category !== cat) return false;
      if (!query) return true;
      return m.filename.toLowerCase().includes(query) || m.category.toLowerCase().includes(query);
    });
  }, [media, q, cat]);

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const NK_GREEN='#084838'; const CREAM='#F7F0E1';

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200 }} />
      <div style={{
        position:'fixed', top:'5vh', left:'5vw', right:'5vw', bottom:'5vh', maxHeight:'90vh',
        background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, boxShadow:'0 8px 32px rgba(0,0,0,0.25)',
        zIndex:201, display:'flex', flexDirection:'column',
      }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid '+HAIR, background:CREAM, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:INK, letterSpacing:'0.02em' }}>Media library</div>
            <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>Click a photo to insert into the newsletter</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:INK_M, cursor:'pointer', fontSize:24, lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:'12px 20px', borderBottom:'1px solid '+HAIR, display:'flex', gap:8, flexWrap:'wrap' }}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search filename or category"
            style={{ flex:'1 1 240px', minWidth:200, padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:12, color:INK, background:'#FFFFFF' }} />
          <select value={cat} onChange={(e) => setCat(e.target.value)}
            style={{ padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:12, color:INK, background:'#FFFFFF' }}>
            <option value="">All categories ({media.length})</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ marginLeft:'auto', alignSelf:'center', fontSize:11, color:INK_M }}>{filtered.length} shown</div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:INK_M }}>Loading photos…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:INK_M }}>No photos match.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12 }}>
              {filtered.map((m) => (
                <button key={m.path} onClick={() => onPick(m.url, m.filename)} style={{
                  background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:4, padding:0, cursor:'pointer',
                  overflow:'hidden', textAlign:'left', display:'flex', flexDirection:'column',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.filename} loading="lazy"
                    style={{ width:'100%', height:120, objectFit:'cover', display:'block', background:'#F5F0E1' }} />
                  <div style={{ padding:'6px 8px', fontSize:10, color:INK, borderTop:'1px solid '+HAIR,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    <div style={{ fontWeight:600 }}>{m.filename}</div>
                    <div style={{ color:INK_M, fontSize:9 }}>{m.category}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
