// app/guest/newsletters/[campaign_id]/_components/MediaPicker.tsx
// PBS 2026-07-23 · Owner: "shows me only some pics — I need the media OTA folder".
// Now fed by /api/marketing/newsletter-templates/list-media: the curated OTA/web
// bucket by default (tier badge on every tile), organized by AREA folder (same
// taxonomy the Coverage matrix uses), with an explicit "show social pool" toggle.
'use client';

import { useEffect, useMemo, useState } from 'react';

interface MediaRow {
  id: string; original_filename: string | null; caption: string | null;
  quality_index: number | null; public_url: string; primary_tier: string | null;
  area: string; area_key: string | null;
}

interface Props { onPick: (url: string, filename: string) => void; onClose: () => void; }

const TIER_LABEL: Record<string, string> = {
  tier_ota_profile: 'OTA', tier_website_hero: 'WEB', tier_social_pool: 'SOCIAL',
};

export default function MediaPicker({ onPick, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [tier, setTier] = useState<'ota' | 'social'>('ota');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    fetch(`/api/marketing/newsletter-templates/list-media${tier === 'social' ? '?tier=social' : ''}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (!alive) return;
        setLoading(false);
        if (j?.ok && Array.isArray(j.rows)) setRows(j.rows as MediaRow[]);
        else setErr(j?.error ?? 'list_media_failed');
      })
      .catch(e => { if (alive) { setLoading(false); setErr(String(e?.message ?? e)); } });
    return () => { alive = false; };
  }, [tier]);

  const areas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.area, (counts.get(r.area) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter(r => {
      if (area && r.area !== area) return false;
      if (!query) return true;
      return (r.original_filename ?? '').toLowerCase().includes(query)
        || (r.caption ?? '').toLowerCase().includes(query)
        || r.area.toLowerCase().includes(query);
    });
  }, [rows, q, area]);

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
            <div style={{ fontSize:14, fontWeight:700, color:INK, letterSpacing:'0.02em' }}>
              Media library · {tier === 'ota' ? 'curated OTA bucket' : 'social pool'}
            </div>
            <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>Click a photo to use it in the newsletter</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:INK_M, cursor:'pointer', fontSize:24, lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:'12px 20px', borderBottom:'1px solid '+HAIR, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search caption, filename or folder"
            style={{ flex:'1 1 220px', minWidth:180, padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:12, color:INK, background:'#FFFFFF' }} />
          <select value={area} onChange={(e) => setArea(e.target.value)}
            style={{ padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:12, color:INK, background:'#FFFFFF', maxWidth:260 }}>
            <option value="">All folders ({rows.length})</option>
            {areas.map(([name, n]) => <option key={name} value={name}>{name} ({n})</option>)}
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:INK_M, cursor:'pointer', userSelect:'none' }}>
            <input type="checkbox" checked={tier === 'social'} onChange={(e) => { setArea(''); setTier(e.target.checked ? 'social' : 'ota'); }} />
            show social pool
          </label>
          <div style={{ marginLeft:'auto', alignSelf:'center', fontSize:11, color:INK_M }}>{filtered.length} shown</div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:INK_M }}>Loading photos…</div>
          ) : err ? (
            <div style={{ padding:40, textAlign:'center', color:'#B03826' }}>{err}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:INK_M }}>No photos match.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12 }}>
              {filtered.map((m) => (
                <button key={m.id} onClick={() => onPick(m.public_url, m.original_filename ?? m.id)} style={{
                  background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:4, padding:0, cursor:'pointer',
                  overflow:'hidden', textAlign:'left', display:'flex', flexDirection:'column', position:'relative',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.public_url} alt={m.caption ?? m.original_filename ?? ''} loading="lazy"
                    style={{ width:'100%', height:120, objectFit:'cover', display:'block', background:'#F5F0E1' }} />
                  <span style={{
                    position:'absolute', top:6, right:6, fontSize:9, fontWeight:700, letterSpacing:'0.06em',
                    padding:'2px 6px', borderRadius:3, color:'#FFFFFF',
                    background: m.primary_tier === 'tier_social_pool' ? '#8B5A1C' : NK_GREEN,
                  }}>
                    {TIER_LABEL[m.primary_tier ?? ''] ?? '—'}
                  </span>
                  <div style={{ padding:'6px 8px', fontSize:10, color:INK, borderTop:'1px solid '+HAIR, overflow:'hidden' }}>
                    <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {m.caption || m.original_filename || m.id}
                    </div>
                    <div style={{ color:INK_M, fontSize:9, display:'flex', justifyContent:'space-between', gap:6 }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.area}</span>
                      {m.quality_index != null && <span>q{m.quality_index}</span>}
                    </div>
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
