// app/marketing/gallery/_components/MediaGallery.tsx v2
// PBS 2026-07-05: lightbox + multi-select + delete/download/send · file size + dimensions.
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface MediaRow {
  asset_id: string; asset_type: string; mime_type: string | null;
  original_filename: string; caption: string | null; alt_text: string | null;
  primary_tier: string | null; secondary_tiers: string[] | null; property_area: string | null;
  captured_at: string | null; created_at: string; qc_score: number | null; ai_confidence: number | null;
  file_size_bytes: number | null; width_px: number | null; height_px: number | null;
  aspect_ratio: string | null; duration_sec: number | null;
  photographer: string | null; license_type: string | null;
  raw_path: string | null; master_path: string | null;
  public_url: string | null; file_size_human: string | null;
}
interface Props { rows: MediaRow[]; }

const TIERS = ['hero','signature','feature','support','archive'];

export default function MediaGallery({ rows }: Props) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [tier, setTier] = useState('');
  const [area, setArea] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<MediaRow | null>(null);
  const [bulkEmail, setBulkEmail] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [msg, setMsg] = useState<{kind:'ok'|'err';text:string}|null>(null);

  const tiers = useMemo(() => { const s = new Set<string>(); for (const r of rows) if (r.primary_tier) s.add(r.primary_tier); return Array.from(s).sort(); }, [rows]);
  const areas = useMemo(() => { const s = new Set<string>(); for (const r of rows) if (r.property_area) s.add(r.property_area); return Array.from(s).sort(); }, [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tier && r.primary_tier !== tier) return false;
      if (area && r.property_area !== area) return false;
      if (!query) return true;
      return (r.original_filename||'').toLowerCase().includes(query) || (r.caption||'').toLowerCase().includes(query) || (r.property_area||'').toLowerCase().includes(query) || (r.primary_tier||'').toLowerCase().includes(query);
    });
  }, [rows, q, tier, area]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const selectAll = () => setSelected((s) => { const n = new Set(s); for (const r of filtered.slice(0,300)) n.add(r.asset_id); return n; });
  const clearSel = () => setSelected(new Set());

  const selectedRows = useMemo(() => rows.filter(r => selected.has(r.asset_id)), [rows, selected]);

  const doAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setWorking(action); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const j = await res.json();
      if (j?.ok) { setMsg({kind:'ok',text: action + ' ok'}); router.refresh(); }
      else setMsg({kind:'err',text: j?.error || 'failed'});
      return j;
    } catch (e) { setMsg({kind:'err',text: e instanceof Error ? e.message : String(e)}); return { ok:false }; }
    finally { setWorking(null); }
  };

  const deleteOne = async (r: MediaRow) => {
    if (!confirm(`Delete "${r.original_filename}"?`)) return;
    await doAction('delete', { asset_id: r.asset_id });
    setLightbox(null);
  };
  const setTierOne = async (r: MediaRow, newTier: string) => {
    await doAction('set-tier', { asset_id: r.asset_id, tier: newTier });
  };
  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} selected assets?`)) return;
    for (const r of selectedRows) await doAction('delete', { asset_id: r.asset_id });
    clearSel();
  };
  const bulkDownload = () => {
    for (const r of selectedRows) if (r.public_url) {
      const a = document.createElement('a'); a.href = r.public_url; a.download = r.original_filename || 'asset'; a.target='_blank';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
  };
  const sendEmail = async () => {
    if (!emailTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo)) { setMsg({kind:'err',text:'valid email required'}); return; }
    const urls = selectedRows.map(r => r.public_url).filter((u): u is string => !!u);
    if (!urls.length) { setMsg({kind:'err',text:'no selected assets have URLs'}); return; }
    setWorking('email'); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'email-share', to_email: emailTo, urls, note: emailNote }),
      });
      const j = await res.json();
      if (j?.ok) { setMsg({kind:'ok',text: `Sent to ${emailTo}`}); setBulkEmail(false); setEmailTo(''); setEmailNote(''); clearSel(); }
      else setMsg({kind:'err',text: 'Email failed: ' + (j?.error || 'unknown')});
    } catch (e) { setMsg({kind:'err',text: e instanceof Error ? e.message : String(e)}); }
    finally { setWorking(null); }
  };

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const NK_GREEN='#084838'; const RED='#B03826'; const CREAM='#F7F0E1';
  const selectStyle = { padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:12, color:INK, background:'#FFFFFF' };
  const btn = { padding:'6px 12px', fontSize:11, fontWeight:600, background:'#FFFFFF', color:INK, border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer' };

  return (
    <div>
      {/* Filter row */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8, alignItems:'center' }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search filename / caption / area"
          style={{ flex:'1 1 240px', minWidth:200, padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:12, color:INK, background:'#FFFFFF' }} />
        <select value={tier} onChange={(e) => setTier(e.target.value)} style={selectStyle}>
          <option value="">All tiers</option>{tiers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={area} onChange={(e) => setArea(e.target.value)} style={selectStyle}>
          <option value="">All areas</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ fontSize:11, color:INK_M, marginLeft:'auto' }}>{filtered.length} of {rows.length}</div>
      </div>

      {/* Selection toolbar */}
      <div style={{ padding:'8px 12px', background: selected.size>0 ? CREAM : '#FAFAF7', border:'1px solid '+HAIR, borderRadius:3, marginBottom:12,
        display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ fontSize:12, color:INK, fontWeight:600 }}>
          {selected.size > 0 ? `${selected.size} selected` : 'Click checkbox to select · click photo for lightbox'}
        </div>
        <button onClick={selectAll} style={btn}>Select all visible</button>
        <button onClick={clearSel} disabled={selected.size===0} style={{...btn, opacity: selected.size===0 ? 0.4 : 1}}>Clear</button>
        <div style={{ borderLeft:'1px solid '+HAIR, height:20, margin:'0 6px' }} />
        <button onClick={bulkDownload} disabled={selected.size===0} style={{...btn, opacity: selected.size===0 ? 0.4 : 1}}>Download ↓</button>
        <button onClick={() => setBulkEmail(true)} disabled={selected.size===0} style={{...btn, opacity: selected.size===0 ? 0.4 : 1}}>Send via email ✉</button>
        <button onClick={bulkDelete} disabled={selected.size===0} style={{...btn, color:RED, borderColor:RED, opacity: selected.size===0 ? 0.4 : 1}}>Delete ×</button>
        {msg && <div style={{ marginLeft:'auto', fontSize:11, color: msg.kind==='ok'?NK_GREEN:RED }}>{msg.text}</div>}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ padding:40, textAlign:'center', color:INK_M, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:4 }}>No assets match.</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 }}>
          {filtered.slice(0, 300).map((r) => {
            const on = selected.has(r.asset_id);
            return (
              <div key={r.asset_id} style={{ background:'#FFFFFF', border: on?'2px solid '+NK_GREEN:'1px solid '+HAIR, borderRadius:4, overflow:'hidden', display:'flex', flexDirection:'column', position:'relative' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(r.asset_id)}
                  style={{ position:'absolute', top:6, left:6, zIndex:2, width:18, height:18, cursor:'pointer' }} />
                <div onClick={() => setLightbox(r)} style={{ cursor: r.public_url ? 'pointer' : 'default' }}>
                  {r.public_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.public_url} alt={r.original_filename} loading="lazy" style={{ width:'100%', height:140, objectFit:'cover', display:'block', background:'#F5F0E1' }} />
                  ) : (
                    <div style={{ width:'100%', height:140, background:'#F5F0E1', color:INK_M, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>no preview</div>
                  )}
                </div>
                <div style={{ padding:'6px 8px', fontSize:10, color:INK, borderTop:'1px solid '+HAIR }}>
                  <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.original_filename}>{r.original_filename}</div>
                  <div style={{ color:INK_M, marginTop:2, display:'flex', gap:6, flexWrap:'wrap', fontSize:9 }}>
                    {r.primary_tier && <span>{r.primary_tier}</span>}
                    {r.property_area && <span>· {r.property_area}</span>}
                    {r.file_size_human && <span>· {r.file_size_human}</span>}
                    {r.width_px && r.height_px && <span>· {r.width_px}×{r.height_px}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {filtered.length > 300 && <div style={{ marginTop:12, textAlign:'center', fontSize:11, color:INK_M }}>Showing 300 of {filtered.length} — refine your search.</div>}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:'#FFFFFF', maxWidth:960, width:'100%', maxHeight:'90vh', borderRadius:6, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'12px 18px', background:CREAM, borderBottom:'1px solid '+HAIR, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:700, color:INK, fontSize:13 }}>{lightbox.original_filename}</div>
              <button onClick={() => setLightbox(null)} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', color:INK_M }}>×</button>
            </div>
            <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
              <div style={{ flex:2, background:'#000000', display:'flex', alignItems:'center', justifyContent:'center', minHeight:400 }}>
                {lightbox.public_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lightbox.public_url} alt={lightbox.original_filename} style={{ maxWidth:'100%', maxHeight:'60vh', display:'block' }} />
                ) : <div style={{ color:'#FFFFFF' }}>No preview available</div>}
              </div>
              <div style={{ flex:1, padding:16, overflowY:'auto', fontSize:12, color:INK, minWidth:280 }}>
                {lightbox.caption && <div style={{ marginBottom:10, fontStyle:'italic' }}>&quot;{lightbox.caption}&quot;</div>}
                <dl style={{ margin:0, display:'grid', gridTemplateColumns:'auto 1fr', gap:'4px 10px', fontSize:11 }}>
                  <dt style={{ color:INK_M }}>Type</dt><dd style={{ margin:0 }}>{lightbox.asset_type} {lightbox.mime_type ? '· '+lightbox.mime_type : ''}</dd>
                  {lightbox.primary_tier && <><dt style={{ color:INK_M }}>Tier</dt><dd style={{ margin:0 }}>{lightbox.primary_tier}</dd></>}
                  {lightbox.property_area && <><dt style={{ color:INK_M }}>Area</dt><dd style={{ margin:0 }}>{lightbox.property_area}</dd></>}
                  {lightbox.file_size_human && <><dt style={{ color:INK_M }}>Size</dt><dd style={{ margin:0 }}>{lightbox.file_size_human}</dd></>}
                  {lightbox.width_px && <><dt style={{ color:INK_M }}>Dimensions</dt><dd style={{ margin:0 }}>{lightbox.width_px}×{lightbox.height_px} px</dd></>}
                  {lightbox.aspect_ratio && <><dt style={{ color:INK_M }}>Aspect</dt><dd style={{ margin:0 }}>{lightbox.aspect_ratio}</dd></>}
                  {lightbox.qc_score !== null && <><dt style={{ color:INK_M }}>QC</dt><dd style={{ margin:0 }}>{lightbox.qc_score}/100</dd></>}
                  {lightbox.photographer && <><dt style={{ color:INK_M }}>By</dt><dd style={{ margin:0 }}>{lightbox.photographer}</dd></>}
                  {lightbox.license_type && <><dt style={{ color:INK_M }}>License</dt><dd style={{ margin:0 }}>{lightbox.license_type}</dd></>}
                  {lightbox.captured_at && <><dt style={{ color:INK_M }}>Captured</dt><dd style={{ margin:0 }}>{new Date(lightbox.captured_at).toLocaleDateString()}</dd></>}
                </dl>
                <div style={{ marginTop:14 }}>
                  <label style={{ fontSize:10, color:INK_M, letterSpacing:'0.04em', textTransform:'uppercase' }}>Change tier</label>
                  <select value={lightbox.primary_tier || ''} onChange={(e) => setTierOne(lightbox, e.target.value)}
                    style={{...selectStyle, display:'block', width:'100%', marginTop:4}}>
                    <option value="">— pick —</option>
                    {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ marginTop:14, display:'flex', gap:6, flexWrap:'wrap' }}>
                  {lightbox.public_url && <a href={lightbox.public_url} download={lightbox.original_filename} target="_blank" rel="noopener noreferrer" style={{...btn, textDecoration:'none', display:'inline-block'}}>Download ↓</a>}
                  {lightbox.public_url && <button onClick={() => { if (lightbox.public_url) navigator.clipboard.writeText(lightbox.public_url); setMsg({kind:'ok',text:'URL copied'}); }} style={btn}>Copy URL</button>}
                  <button onClick={() => deleteOne(lightbox)} style={{...btn, color:RED, borderColor:RED}}>Delete ×</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk email modal */}
      {bulkEmail && (
        <div onClick={() => setBulkEmail(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:210, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:'#FFFFFF', maxWidth:480, width:'100%', borderRadius:6, padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:INK, marginBottom:12 }}>Send {selected.size} asset{selected.size===1?'':'s'} by email</div>
            <label style={{ fontSize:11, color:INK_M, textTransform:'uppercase', letterSpacing:'0.04em' }}>Recipient email</label>
            <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="name@example.com"
              style={{ display:'block', width:'100%', padding:'8px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:13, marginTop:4, marginBottom:12 }} />
            <label style={{ fontSize:11, color:INK_M, textTransform:'uppercase', letterSpacing:'0.04em' }}>Note (optional)</label>
            <textarea rows={3} value={emailNote} onChange={(e) => setEmailNote(e.target.value)}
              style={{ display:'block', width:'100%', padding:'8px 10px', border:'1px solid '+HAIR, borderRadius:3, fontSize:12, marginTop:4, marginBottom:14, resize:'vertical' }} />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setBulkEmail(false)} style={btn}>Cancel</button>
              <button onClick={sendEmail} disabled={working==='email'} style={{...btn, background: NK_GREEN, color:'#FFFFFF', border:'none'}}>
                {working==='email' ? 'Sending…' : 'Send ✉'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
