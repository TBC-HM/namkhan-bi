// app/guest/newsletters/_components/RecipientsButton.tsx
// PBS 2026-07-05: click the Recipients number to open a popup with names + delete buttons.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Recipient {
  guest_id: string; full_name: string | null; email: string | null;
  country: string | null; send_status: string; send_at: string | null;
  sent_at: string | null; error: string | null; unsubscribed_at: string | null;
}
interface Props { campaign_id: string; campaign_name: string; count: number; }

export default function RecipientsButton({ campaign_id, campaign_name, count }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Recipient[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch(`/api/newsletter/recipients?campaign_id=${encodeURIComponent(campaign_id)}`);
      const j = await res.json();
      setLoading(false);
      if (j?.ok) setRows(j.recipients as Recipient[]);
      else setMsg('Load failed: ' + (j?.error || 'unknown'));
    } catch (e) {
      setLoading(false);
      setMsg('Network error: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  useEffect(() => { if (open) load(); }, [open, campaign_id]);

  const remove = async (guest_id: string, email: string | null) => {
    if (!confirm(`Remove ${email || guest_id} from this campaign?`)) return;
    setRemoving(guest_id); setMsg(null);
    try {
      const res = await fetch('/api/newsletter/recipients', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id, guest_id }),
      });
      const j = await res.json();
      if (j?.ok) {
        setRows((s) => s.filter((r) => r.guest_id !== guest_id));
        router.refresh();
      } else {
        setMsg('Remove failed: ' + (j?.error || 'unknown'));
      }
    } catch (e) {
      setMsg('Network error: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setRemoving(null); }
  };

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A';
  const NK_GREEN='#084838'; const CREAM='#F7F0E1'; const RED='#B03826';

  const badge = (s: string) => {
    const map: Record<string, [string,string]> = {
      pending: ['#FCF3D5','#5A4610'], queued: ['#FCF3D5','#5A4610'], queued_smtp_needed: ['#FCF3D5','#5A4610'],
      sent: ['#E6F2E6','#1F5C2C'], failed: ['#FBE8E4','#8A2419'], cancelled: ['#EFEFEF','#5A5A5A'],
    };
    const [bg,fg] = map[s] || ['#FAFAF7','#5A5A5A'];
    return <span style={{ background:bg, color:fg, padding:'2px 6px', borderRadius:3, fontSize:10, fontWeight:600 }}>{s}</span>;
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        background:'none', border:'none', color: NK_GREEN, cursor:'pointer',
        fontWeight:700, fontSize:12, padding:0, textDecoration:'underline dotted',
      }}>{count}</button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200 }} />
          <div style={{
            position:'fixed', top:'8vh', left:'50%', transform:'translateX(-50%)', width:640, maxWidth:'92vw', maxHeight:'80vh',
            background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, boxShadow:'0 8px 32px rgba(0,0,0,0.25)',
            zIndex:201, display:'flex', flexDirection:'column',
          }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid '+HAIR, background: CREAM,
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:INK }}>Recipients</div>
                <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>{campaign_name}</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:INK_M, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {loading ? <div style={{ padding:24, textAlign:'center', color:INK_M }}>Loading…</div>
              : rows.length === 0 ? <div style={{ padding:24, textAlign:'center', color:INK_M }}>No recipients.</div>
              : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'#FAFAF7', borderBottom:'1px solid '+HAIR }}>
                    <th style={th}>Name</th><th style={th}>Email</th><th style={th}>Country</th>
                    <th style={th}>Status</th><th style={{ ...th, textAlign:'right', width:110 }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.guest_id} style={{ borderBottom:'1px solid '+HAIR }}>
                        <td style={td}>{r.full_name || '—'}</td>
                        <td style={{ ...td, fontFamily:'ui-monospace,monospace', fontSize:11 }}>{r.email}</td>
                        <td style={td}>{r.country || '—'}</td>
                        <td style={td}>{badge(r.send_status)}</td>
                        <td style={{ ...td, textAlign:'right' }}>
                          <button onClick={() => remove(r.guest_id, r.email)} disabled={removing === r.guest_id} style={{
                            padding:'3px 8px', fontSize:10, fontWeight:600,
                            background:'#FFFFFF', color:RED, border:'1px solid '+RED,
                            borderRadius:3, cursor: removing === r.guest_id ? 'default' : 'pointer',
                          }}>{removing === r.guest_id ? 'Removing…' : 'Remove'}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {msg && <div style={{ padding:'10px 18px', borderTop:'1px solid '+HAIR, fontSize:11, color: RED }}>{msg}</div>}
          </div>
        </>
      )}
    </>
  );
}

const th: React.CSSProperties = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#1B1B1B', textAlign:'left' };
const td: React.CSSProperties = { padding:'8px 10px', fontSize:12, color:'#1B1B1B' };
