// app/marketing/prospects/_components/ProspectsClient.tsx
// PBS 2026-07-05: interactive prospects table — company + pin + per-row tag/delete + mass ops.
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProspectRow } from '../page';

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#084838';
const RED='#B03826'; const CREAM='#F7F0E1'; const GOLD='#C79A6B';

type TagFacet = [string, number];

export default function ProspectsClient({ initialRows, tagFacets }: { initialRows: ProspectRow[]; tagFacets: TagFacet[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [realOnly, setRealOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind:'ok'|'err'; text:string } | null>(null);
  const [bulkTagInput, setBulkTagInput] = useState('');

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return initialRows.filter(r => {
      if (pinnedOnly && !r.is_pinned) return false;
      if (realOnly && r.enrichment !== 'supplied') return false;
      if (tag && !(r.tags ?? []).includes(tag)) return false;
      if (qq) {
        const bag = [r.full_name, r.email, r.company, r.website, r.country, (r.tags ?? []).join(' ')].filter(Boolean).join(' ').toLowerCase();
        if (!bag.includes(qq)) return false;
      }
      return true;
    });
  }, [initialRows, q, tag, pinnedOnly, realOnly]);

  const toggle = (id: string) => {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const clearSel = () => setSelected(new Set());
  const selectVisible = () => setSelected(new Set(filtered.slice(0, 500).map(r => r.subscriber_id)));
  const selectedIds = Array.from(selected);

  const call = async (rpc: string, payload: object, ok = 'ok') => {
    setWorking(rpc); setMsg(null);
    try {
      const res = await fetch('/api/marketing/prospects/action', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ rpc, ...payload }),
      });
      const j = await res.json();
      if (j?.ok) { setMsg({ kind:'ok', text: ok }); router.refresh(); return j; }
      setMsg({ kind:'err', text: j?.error ?? 'failed' });
      return j;
    } catch (e) { setMsg({ kind:'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setWorking(null); }
  };

  const togglePin  = (id: string) => call('fn_prospect_toggle_pin', { p_subscriber_id: id }, 'pin toggled');
  const delOne     = (id: string, label: string) => confirm(`Delete "${label}"?`) && call('fn_prospect_delete', { p_subscriber_id: id }, 'deleted');
  const addTagOne  = (id: string) => { const t = prompt('New tag key (letters, underscores):'); if (t) call('fn_prospect_add_tag', { p_subscriber_id: id, p_tag_key: t }, 'tag added'); };
  const removeTagOne = (id: string, tagKey: string) => call('fn_prospect_remove_tag', { p_subscriber_id: id, p_tag_key: tagKey }, 'tag removed');
  const bulkDelete = () => confirm(`Delete ${selectedIds.length} prospects?`) && call('fn_prospect_bulk_delete', { p_subscriber_ids: selectedIds }, `${selectedIds.length} deleted`).then(() => clearSel());
  const bulkTag    = () => { if (!bulkTagInput.trim()) return; call('fn_prospect_bulk_add_tag', { p_subscriber_ids: selectedIds, p_tag_key: bulkTagInput.trim() }, `tag applied to ${selectedIds.length}`).then(() => setBulkTagInput('')); };

  return (
    <div>
      {/* Filter row */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
        <input type="search" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search name, email, company, website, country…"
          style={{ flex:'1 1 260px', minWidth:220, ...input }} />
        <select value={tag} onChange={e => setTag(e.target.value)} style={input}>
          <option value="">All tags</option>
          {tagFacets.map(([t, n]) => <option key={t} value={t}>{t} ({n})</option>)}
        </select>
        <label style={check}><input type="checkbox" checked={pinnedOnly} onChange={e => setPinnedOnly(e.target.checked)} /> Pinned only</label>
        <label style={check}><input type="checkbox" checked={realOnly}   onChange={e => setRealOnly(e.target.checked)} /> Real emails only</label>
        <div style={{ marginLeft:'auto', fontSize:11, color:INK_M }}>
          {filtered.length.toLocaleString()} / {initialRows.length.toLocaleString()}
        </div>
      </div>

      {/* Bulk toolbar */}
      <div style={{ padding:'10px 12px', background: selected.size > 0 ? CREAM : '#FAFAF7',
                    border:'1px solid '+HAIR, borderRadius:4, marginBottom:12,
                    display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ fontSize:12, fontWeight:600, color:INK }}>
          {selected.size > 0 ? `${selected.size} selected` : 'Click ☐ to select rows for bulk actions'}
        </div>
        <button onClick={selectVisible} style={btn}>Select all visible</button>
        <button onClick={clearSel} disabled={selected.size===0} style={{ ...btn, opacity: selected.size===0 ? 0.4 : 1 }}>Clear</button>
        <div style={{ borderLeft:'1px solid '+HAIR, height:20, margin:'0 4px' }} />
        <input placeholder="new tag key" value={bulkTagInput} onChange={e => setBulkTagInput(e.target.value)} style={{ ...input, width:140 }} />
        <button onClick={bulkTag}    disabled={selected.size===0 || !bulkTagInput.trim() || working!==null}
          style={{ ...btn, opacity: (selected.size===0||!bulkTagInput.trim())?0.4:1 }}>Apply tag to {selected.size}</button>
        <button onClick={bulkDelete} disabled={selected.size===0 || working!==null}
          style={{ ...btn, color:RED, borderColor:RED, opacity: selected.size===0 ? 0.4 : 1 }}>Delete {selected.size} ×</button>
        {msg && <div style={{ marginLeft:'auto', fontSize:11, color: msg.kind==='ok' ? GREEN : RED }}>{msg.text}</div>}
      </div>

      {/* Table */}
      <div style={{ border:'1px solid '+HAIR, borderRadius:6, background:'#FFFFFF', overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'#FAFAF7', borderBottom:'1px solid '+HAIR }}>
              <th style={{ ...th, width:36 }}><input type="checkbox"
                checked={selected.size>0 && selected.size===Math.min(500, filtered.length)}
                onChange={e => e.target.checked ? selectVisible() : clearSel()} /></th>
              <th style={{ ...th, width:34 }}>★</th>
              <th style={th}>Company · Website</th>
              <th style={th}>Contact</th>
              <th style={th}>Country</th>
              <th style={th}>Tags</th>
              <th style={{ ...th, textAlign:'right' }}>Sends</th>
              <th style={{ ...th, textAlign:'right', width:240 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 500).map(r => {
              const on = selected.has(r.subscriber_id);
              const isGuessed = r.enrichment === 'guessed_info';
              return (
                <tr key={r.subscriber_id} style={{ borderTop:'1px solid '+HAIR, background: on ? '#F5FAF7' : 'transparent' }}>
                  <td style={tdC}><input type="checkbox" checked={on} onChange={() => toggle(r.subscriber_id)} /></td>
                  <td style={tdC}>
                    <button onClick={() => togglePin(r.subscriber_id)} disabled={working !== null}
                      style={{ background:'none', border:'none', cursor:'pointer', fontSize:16,
                               color: r.is_pinned ? GOLD : '#C8C0A6' }}
                      title={r.is_pinned ? 'Unpin' : 'Pin'}>{r.is_pinned ? '★' : '☆'}</button>
                  </td>
                  <td style={tdL}>
                    <div style={{ fontWeight:600 }}>{r.company ?? '—'}</div>
                    {r.website && (
                      <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>
                        <a href={r.website} target="_blank" rel="noreferrer" style={{ color:INK_M, textDecoration:'underline' }}>
                          {r.website.replace(/^https?:\/\//,'')}
                        </a>
                      </div>
                    )}
                  </td>
                  <td style={tdL}>
                    {r.email && (
                      <div style={{ fontSize:11, color: isGuessed ? '#8B5A1C' : INK }}>
                        {r.email}
                        {isGuessed && <span title="Guessed from domain — may bounce" style={{ marginLeft:6, fontSize:9, padding:'1px 5px', background:'#FBEDD8', color:'#8B5A1C', border:'1px solid #E8C89B', borderRadius:6 }}>guess</span>}
                      </div>
                    )}
                    {r.full_name && <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>{r.full_name}</div>}
                  </td>
                  <td style={tdL}>{r.country ?? '—'}</td>
                  <td style={tdL}>
                    {(r.tags ?? []).length === 0 ? <span style={{ color:'#C8C0A6', fontSize:10 }}>—</span> :
                      (r.tags ?? []).map(t => (
                        <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:3, margin:'0 3px 3px 0', padding:'1px 6px 1px 8px', fontSize:10, background:CREAM, border:'1px solid '+HAIR, borderRadius:8 }}>
                          {t}
                          <button onClick={() => removeTagOne(r.subscriber_id, t)} disabled={working !== null}
                            style={{ background:'none', border:'none', cursor:'pointer', color:INK_M, fontSize:10, padding:0 }}
                            title="Remove tag">×</button>
                        </span>
                      ))}
                  </td>
                  <td style={tdR}>{r.funnel_sends}</td>
                  <td style={{ ...tdL, textAlign:'right' }}>
                    <button onClick={() => addTagOne(r.subscriber_id)} disabled={working !== null} style={actionBtn}>+ tag</button>
                    <button onClick={() => delOne(r.subscriber_id, r.company || r.email || 'row')} disabled={working !== null}
                      style={{ ...actionBtn, color:RED, borderColor:'#E8B7AB' }}>Delete ×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 500 && (
          <div style={{ padding:'10px 12px', fontSize:11, color:INK_M, textAlign:'center' }}>
            Showing 500 of {filtered.length.toLocaleString()} — refine search or tag filter.
          </div>
        )}
        {filtered.length === 0 && (
          <div style={{ padding:'40px 24px', fontSize:12, color:INK_M, textAlign:'center' }}>
            No prospects match your filters.
          </div>
        )}
      </div>
    </div>
  );
}

const input = { padding:'6px 10px', fontSize:12, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:3, color:INK };
const check = { display:'flex', alignItems:'center', gap:4, fontSize:11, color:INK, cursor:'pointer' };
const btn = { padding:'5px 10px', fontSize:11, fontWeight:600, background:'#FFFFFF', color:INK, border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer' };
const actionBtn = { display:'inline-block', padding:'3px 8px', marginLeft:4, fontSize:10, fontWeight:600, background:'#FFFFFF', color:INK, border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer' };
const th  = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, color:INK, textAlign:'left' as const, whiteSpace:'nowrap' as const };
const tdL = { padding:'8px 10px', fontSize:12, color:INK };
const tdR = { padding:'8px 10px', fontSize:12, color:INK, textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const };
const tdC = { padding:'8px 6px', textAlign:'center' as const };
