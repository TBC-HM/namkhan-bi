// app/marketing/media/_components/MediaGallery.tsx
// PBS 2026-07-05: gallery grid with search + filters. Click a photo to copy its URL.
'use client';

import { useMemo, useState } from 'react';

interface MediaRow {
  asset_id: string; asset_type: string; original_filename: string;
  caption: string | null; primary_tier: string | null; property_area: string | null;
  captured_at: string | null; qc_score: number | null; public_url: string | null;
  width_px: number | null; height_px: number | null;
}
interface Props { rows: MediaRow[]; }

export default function MediaGallery({ rows }: Props) {
  const [q, setQ] = useState('');
  const [tier, setTier] = useState('');
  const [area, setArea] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const tiers = useMemo(() => {
    const s = new Set<string>(); for (const r of rows) if (r.primary_tier) s.add(r.primary_tier);
    return Array.from(s).sort();
  }, [rows]);
  const areas = useMemo(() => {
    const s = new Set<string>(); for (const r of rows) if (r.property_area) s.add(r.property_area);
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tier && r.primary_tier !== tier) return false;
      if (area && r.property_area !== area) return false;
      if (!query) return true;
      return (
        (r.original_filename || '').toLowerCase().includes(query) ||
        (r.caption || '').toLowerCase().includes(query) ||
        (r.property_area || '').toLowerCase().includes(query) ||
        (r.primary_tier || '').toLowerCase().includes(query)
      );
    });
  }, [rows, q, tier, area]);

  const copyUrl = async (url: string, filename: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(filename); setTimeout(() => setCopied(null), 1500); }
    catch { alert('Copy failed. URL: ' + url); }
  };

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const NK_GREEN='#084838';
  const selectStyle = { padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:12, color:INK, background:'#FFFFFF' };

  return (
    <div>
      {/* Filter row */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12, alignItems:'center' }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search filename / caption / area"
          style={{ flex:'1 1 240px', minWidth:200, padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:12, color:INK, background:'#FFFFFF' }} />
        <select value={tier} onChange={(e) => setTier(e.target.value)} style={selectStyle}>
          <option value="">All tiers</option>
          {tiers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={area} onChange={(e) => setArea(e.target.value)} style={selectStyle}>
          <option value="">All areas</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ fontSize:11, color:INK_M, marginLeft:'auto' }}>{filtered.length} of {rows.length}</div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding:40, textAlign:'center', color:INK_M, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:4 }}>
          No assets match your filter.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 }}>
          {filtered.slice(0, 300).map((r) => (
            <button key={r.asset_id} onClick={() => r.public_url && copyUrl(r.public_url, r.original_filename)}
              disabled={!r.public_url}
              style={{
                background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:4, padding:0,
                cursor: r.public_url ? 'pointer' : 'default',
                overflow:'hidden', textAlign:'left', display:'flex', flexDirection:'column',
              }}>
              {r.public_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.public_url} alt={r.original_filename} loading="lazy"
                  style={{ width:'100%', height:140, objectFit:'cover', display:'block', background:'#F5F0E1' }} />
              ) : (
                <div style={{ width:'100%', height:140, background:'#F5F0E1', color:INK_M, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>
                  no preview
                </div>
              )}
              <div style={{ padding:'6px 8px', fontSize:10, color:INK, borderTop:'1px solid '+HAIR }}>
                <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.original_filename}</div>
                <div style={{ color:INK_M, marginTop:2, display:'flex', gap:6, flexWrap:'wrap' }}>
                  {r.primary_tier && <span>{r.primary_tier}</span>}
                  {r.property_area && <span>· {r.property_area}</span>}
                </div>
                {copied === r.original_filename && (
                  <div style={{ marginTop:4, color:NK_GREEN, fontWeight:600 }}>✓ URL copied</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {filtered.length > 300 && (
        <div style={{ marginTop:12, textAlign:'center', fontSize:11, color:INK_M }}>
          Showing 300 of {filtered.length} — refine your search.
        </div>
      )}
    </div>
  );
}
