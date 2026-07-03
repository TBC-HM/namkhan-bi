'use client';
// app/settings/marketing/listings/_components/ListingsEditor.tsx
// PBS 2026-07-03: editable table for marketing.external_listings.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import SourceBadge from '@/components/marketing/SourceBadge';

interface Row {
  id?: number;
  channel: string;
  url: string | null;
  admin_url: string | null;
  external_id: string | null;
  handle: string | null;
  is_active: boolean;
  notes: string | null;
}

interface Props { initial: Row[]; }

const WHITE='#FFFFFF'; const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_S='#3A3A3A';
const INK_M='#5A5A5A'; const GREEN='#1F3A2E'; const RED='#B03826';

const KNOWN_CHANNELS = [
  'google','google_maps','tripadvisor','booking','expedia','agoda','ctrip',
  'instagram','facebook','tiktok','youtube','website','cloudbeds_admin','resend_dashboard','other',
];

function badgeSource(channel: string): string {
  const map: Record<string,string> = {
    google:'google', google_maps:'google', tripadvisor:'tripadvisor',
    booking:'booking', expedia:'expedia', agoda:'agoda',
    instagram:'instagram', facebook:'facebook', tiktok:'tiktok', youtube:'youtube',
    website:'direct', cloudbeds_admin:'cloudbeds',
  };
  return map[channel] ?? channel;
}

export default function ListingsEditor({ initial }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [newChannel, setNewChannel] = useState<string>('');

  function updateRow(index: number, patch: Partial<Row>) {
    setRows(rows.map((r,i) => i === index ? { ...r, ...patch } : r));
  }

  async function saveRow(index: number) {
    const r = rows[index];
    const key = r.channel;
    setSavingId(key); setMsg(null);
    try {
      const { error } = await supabase.rpc('fn_upsert_external_listing', {
        p_property_id: PROPERTY_ID,
        p_channel: r.channel,
        p_url: r.url ?? '',
        p_admin_url: r.admin_url ?? '',
        p_external_id: r.external_id ?? '',
        p_handle: r.handle ?? '',
        p_is_active: r.is_active,
        p_notes: r.notes ?? '',
      });
      if (error) throw error;
      setMsg({ id: key, text: 'Saved', ok: true });
      router.refresh();
    } catch (e: any) {
      setMsg({ id: key, text: 'Error: ' + (e?.message ?? e), ok: false });
    } finally {
      setSavingId(null);
    }
  }

  function addChannel() {
    const c = newChannel.trim().toLowerCase().replace(/[^a-z0-9_]/g,'_');
    if (!c) return;
    if (rows.some((r) => r.channel === c)) { setMsg({ id: c, text: 'Channel already exists', ok: false }); return; }
    setRows([...rows, { channel: c, url: '', admin_url: '', external_id: '', handle: '', is_active: true, notes: '' }]);
    setNewChannel('');
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ background:'#F5F0E1', border:'1px solid '+HAIR, borderRadius:6, padding:'10px 14px', fontSize:11, color:INK_S, lineHeight:1.5 }}>
        <strong>How this powers the rest of the app.</strong> Each row here feeds:
        review scraper (booking/expedia/tripadvisor/agoda) · Google integration (external_id becomes the location_id) ·
        newsletter footer (social handles) · reputation page (badges + status).
      </div>
      <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead style={{ background:'#FAFAF7' }}>
            <tr>
              <th style={th}>Channel</th>
              <th style={th}>URL (public)</th>
              <th style={th}>Admin URL</th>
              <th style={{ ...th, width:110 }}>External ID</th>
              <th style={{ ...th, width:130 }}>Handle</th>
              <th style={{ ...th, width:60,  textAlign:'center' }}>Active</th>
              <th style={{ ...th, width:180 }}>Notes</th>
              <th style={{ ...th, width:100, textAlign:'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.channel} style={{ borderTop:'1px solid '+HAIR }}>
                <td style={td}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <SourceBadge source={badgeSource(r.channel)} />
                    <span style={{ color:INK, fontWeight:500 }}>{r.channel}</span>
                  </div>
                </td>
                <td style={td}><input type="text" value={r.url ?? ''} onChange={(e) => updateRow(i,{ url: e.target.value })} placeholder="https://…" style={inputStyle} /></td>
                <td style={td}><input type="text" value={r.admin_url ?? ''} onChange={(e) => updateRow(i,{ admin_url: e.target.value })} placeholder="admin URL" style={inputStyle} /></td>
                <td style={td}><input type="text" value={r.external_id ?? ''} onChange={(e) => updateRow(i,{ external_id: e.target.value })} placeholder="id" style={inputStyle} /></td>
                <td style={td}><input type="text" value={r.handle ?? ''} onChange={(e) => updateRow(i,{ handle: e.target.value })} placeholder="@handle" style={inputStyle} /></td>
                <td style={{ ...td, textAlign:'center' }}>
                  <input type="checkbox" checked={r.is_active} onChange={(e) => updateRow(i,{ is_active: e.target.checked })} />
                </td>
                <td style={td}><input type="text" value={r.notes ?? ''} onChange={(e) => updateRow(i,{ notes: e.target.value })} placeholder="notes" style={inputStyle} /></td>
                <td style={{ ...td, textAlign:'right' }}>
                  <button type="button" onClick={() => saveRow(i)} disabled={savingId === r.channel} style={{
                    padding:'4px 10px', fontSize:11, fontWeight:600,
                    background: savingId === r.channel ? '#8A8A8A' : GREEN,
                    color:WHITE, border:'none', borderRadius:4, cursor: savingId === r.channel ? 'default' : 'pointer',
                  }}>{savingId === r.channel ? 'Saving…' : 'Save'}</button>
                  {msg?.id === r.channel && (
                    <div style={{ fontSize:10, marginTop:2, color: msg.ok ? GREEN : RED }}>{msg.text}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <input type="text" placeholder="add a new channel (e.g. weibo)" value={newChannel} onChange={(e) => setNewChannel(e.target.value)}
          list="channels" style={{ ...inputStyle, width:280 }} />
        <datalist id="channels">{KNOWN_CHANNELS.map(c => <option key={c} value={c} />)}</datalist>
        <button type="button" onClick={addChannel} style={{
          padding:'6px 14px', fontSize:12, fontWeight:600,
          background:GREEN, color:WHITE, border:'none', borderRadius:4, cursor:'pointer',
        }}>+ Add channel</button>
      </div>
    </div>
  );
}

const th: any = { padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, borderBottom:'1px solid '+HAIR };
const td: any = { padding:'6px 8px', verticalAlign:'top', color:INK };
const inputStyle: React.CSSProperties = { width:'100%', padding:'4px 8px', border:'1px solid '+HAIR, borderRadius:4, fontSize:12, color:INK, boxSizing:'border-box' };
