'use client';
// app/guest/newsletters/director/_components/DirectorClient.tsx
// PBS 2026-07-22 (Newsletter Engine v2) · 2026-07-22 v3 (COCKPIT REFACTOR):
//   * Editorial goals editor MOVED to Property Settings → Audience (EditorialGoalsPanel).
//     This client now shows a compact read-only summary + link out.
//   * Fixed "grid renders empty" bug: month cells now list every slot with title
//     + status pill (previously only tiny 8x8px dots — PBS read that as "empty").
//   * Weight scale bumped to 0-100 (share-of-slots semantic). Read-only chip shows
//     normalised share ≈ N% per goal.
//
// Bug root cause (2026-07-22): month cells rendered slots as 8x8 dots inside a
// wrap-flex row. With 22 slots spread across 5 months, each cell only showed 4-5
// tiny dots that were invisible against the cream background. Fix = render each
// slot as a titled row with its status pill (visible + clickable).

import { Fragment, useMemo, useState, useTransition } from 'react';
import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';

export interface GoalRow {
  id: number; property_id: number; goal_key: string; goal_label: string;
  weight: number; active: boolean;
}
export interface SlotRow {
  id: number; property_id: number; slot_date: string; audience_type: 'b2c'|'b2b';
  campaign_kind: 'broadcast'|'lifecycle'|'sequence'; goal_tag: string;
  title: string; subject: string | null; body_md: string | null;
  hero_asset_id: string | null; ctas: unknown; target_segments: string[];
  status: 'proposed'|'refined'|'approved'|'scheduled'|'sent'|'skipped';
  linked_campaign_id: string | null; ai_notes: string | null;
  created_at: string; updated_at: string;
}

interface Props {
  propertyId: number;
  initialGoals: GoalRow[];
  initialSlots: SlotRow[];
}

const HAIR = '#E6DFCC';
const INK  = '#1B1B1B';
const INK_M = '#5A5A5A';
const PRIMARY = '#1F3A2E';

const STATUS_COLOR: Record<SlotRow['status'], { bg: string; fg: string; brd: string }> = {
  proposed:  { bg:'#F5EAD9', fg:'#8B5A1C', brd:'#E8C89B' },
  refined:   { bg:'#E4EAF1', fg:'#1F3A5C', brd:'#A0B4CF' },
  approved:  { bg:'#E4F1E0', fg:'#1F5C2C', brd:'#A9CFA0' },
  scheduled: { bg:'#E4F1E0', fg:'#1F5C2C', brd:'#A9CFA0' },
  sent:      { bg:'#EEEEEE', fg:'#3A3A3A', brd:'#DDDDDD' },
  skipped:   { bg:'#FBE8E4', fg:'#8A2419', brd:'#E8B7AB' },
};

function fmtMonth(d: Date): string {
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', timeZone: 'UTC' }); }
  catch { return iso; }
}
function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}

export default function DirectorClient({ propertyId, initialGoals, initialSlots }: Props) {
  const [goals] = useState<GoalRow[]>(initialGoals);
  const [slots, setSlots] = useState<SlotRow[]>(initialSlots);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [drawerSlot, setDrawerSlot] = useState<SlotRow | null>(null);
  const [refineText, setRefineText] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [msg, setMsg] = useState<string>('');
  const [genFrom, setGenFrom] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [genTo, setGenTo] = useState<string>('2026-12-31');
  const [regenerateEmptyOnly, setRegenerateEmptyOnly] = useState(true);
  const [, startT] = useTransition();

  const months = useMemo(() => {
    const arr: { key: string; label: string; date: Date }[] = [];
    const start = new Date(genFrom || new Date().toISOString().slice(0,10));
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      arr.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`, label: fmtMonth(d), date: d });
    }
    return arr;
  }, [genFrom]);

  const slotsByMonth = useMemo(() => {
    const m = new Map<string, SlotRow[]>();
    for (const s of slots) {
      const k = monthKey(s.slot_date);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    // Sort within each month by slot_date
    for (const [, arr] of m) arr.sort((a, b) => a.slot_date.localeCompare(b.slot_date));
    return m;
  }, [slots]);

  const activeGoals = goals.filter(g => g.active);
  const totalWeight = activeGoals.reduce((s, g) => s + (g.weight || 0), 0) || 1;

  async function generatePlan() {
    setBusy('generate');
    setMsg('Generating 12-month plan — this can take 30-60s…');
    try {
      const res = await fetch('/api/marketing/director/generate-plan', {
        method: 'POST', headers: {'content-type':'application/json'},
        body: JSON.stringify({
          property_id: propertyId,
          start_date: genFrom,
          end_date: genTo,
          audience_types: ['b2c'],
          regenerate_empty_only: regenerateEmptyOnly,
        }),
      });
      if (!res.ok) { setMsg(`Generate failed: ${await res.text()}`); return; }
      const j = await res.json();
      setMsg(`Generated ${j.summary?.slots_created ?? '?'} slots. Reloading…`);
      startT(() => { window.location.reload(); });
    } finally { setBusy(''); }
  }

  async function refineSlot(slot: SlotRow) {
    if (!refineText.trim()) { setMsg('Enter a refine instruction first.'); return; }
    setBusy('refine');
    try {
      const res = await fetch('/api/marketing/director/refine-slot', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ slot_id: slot.id, instruction: refineText }),
      });
      if (!res.ok) { setMsg(`Refine failed: ${await res.text()}`); return; }
      const j = await res.json();
      const updated: SlotRow = { ...slot, title: j.title ?? slot.title, subject: j.subject ?? slot.subject, body_md: j.body_md ?? slot.body_md, status: 'refined', updated_at: new Date().toISOString() };
      setSlots(prev => prev.map(x => x.id===slot.id ? updated : x));
      setDrawerSlot(updated);
      setRefineText('');
      setMsg('Slot refined.');
    } finally { setBusy(''); setTimeout(()=>setMsg(''), 2500); }
  }

  async function approveSlot(slot: SlotRow, schedule: boolean) {
    setBusy('approve');
    try {
      const res = await fetch('/api/marketing/director/approve-slot', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ slot_id: slot.id, schedule }),
      });
      if (!res.ok) { setMsg(`Approve failed: ${await res.text()}`); return; }
      const j = await res.json();
      const updated: SlotRow = { ...slot, status: schedule?'scheduled':'approved', linked_campaign_id: j.campaign_id ?? slot.linked_campaign_id };
      setSlots(prev => prev.map(x => x.id===slot.id ? updated : x));
      setDrawerSlot(updated);
      setMsg(schedule ? 'Approved & scheduled.' : 'Approved.');
    } finally { setBusy(''); setTimeout(()=>setMsg(''), 2000); }
  }

  async function bulkApprove(schedule: boolean) {
    setBusy('bulk');
    try {
      const res = await fetch('/api/marketing/director/bulk-approve', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ property_id: propertyId, from: genFrom, to: genTo, schedule }),
      });
      if (!res.ok) { setMsg(`Bulk approve failed: ${await res.text()}`); return; }
      const j = await res.json();
      setMsg(`Approved ${j.approved_count} slots.`);
      startT(() => { window.location.reload(); });
    } finally { setBusy(''); }
  }

  return (
    <div style={{ display:'grid', gap:24 }}>
      {msg && <div style={infoBox}>{msg}</div>}

      {/* GOALS SUMMARY (read-only) */}
      <section style={panel}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <h3 style={h3}>Editorial goals · read-only summary</h3>
          <TenantLink href="/settings/property/audience#editorial-goals" style={editLink}>Edit weights in Settings → Audience → Editorial Goals →</TenantLink>
        </div>
        <p style={muted}>The AI Director plans slots proportional to these normalised weights.</p>

        {activeGoals.length === 0 ? (
          <div style={{ padding:12, background:'#FBE8E4', color:'#8A2419', border:'1px solid #E8B7AB', borderRadius:4, fontSize:12 }}>
            No active goals — the Director will stall until you set some.
          </div>
        ) : (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {activeGoals.sort((a,b)=>b.weight-a.weight).map((g) => {
              const share = totalWeight > 0 ? (g.weight / totalWeight) : 0;
              return (
                <span key={g.goal_key} style={goalChip}>
                  <strong style={{ color:INK }}>{g.goal_label}</strong>
                  <span style={{ marginLeft:6, color:INK_M }}>·</span>
                  <span style={{ marginLeft:6, fontVariantNumeric:'tabular-nums', color:INK }}>{(share*100).toFixed(0)}%</span>
                  <span style={{ marginLeft:4, fontSize:10, color:INK_M }}>(w={g.weight})</span>
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* GENERATE PLAN */}
      <section style={panel}>
        <h3 style={h3}>Generate 12-month plan</h3>
        <div style={{ display:'flex', gap:12, alignItems:'end', flexWrap:'wrap' }}>
          <label style={fieldWrap}>
            <span style={fieldLabel}>From</span>
            <input type="date" value={genFrom} onChange={e=>setGenFrom(e.target.value)} style={input} />
          </label>
          <label style={fieldWrap}>
            <span style={fieldLabel}>To</span>
            <input type="date" value={genTo} onChange={e=>setGenTo(e.target.value)} style={input} />
          </label>
          <label style={{ fontSize:12, color: INK, display:'flex', alignItems:'center', gap:4 }}>
            <input type="checkbox" checked={regenerateEmptyOnly} onChange={e=>setRegenerateEmptyOnly(e.target.checked)} />
            Only fill empty slots
          </label>
          <button onClick={generatePlan} disabled={busy!==''} style={ctaButton}>
            {busy==='generate' ? 'Generating…' : 'Generate plan'}
          </button>
          <button onClick={()=>bulkApprove(true)} disabled={busy!==''} style={secondaryButton}>Bulk approve + schedule range</button>
        </div>
      </section>

      {/* MONTH GRID — with slot lists (not tiny dots) */}
      <section style={panel}>
        <h3 style={h3}>12-month calendar · {slots.length} slot{slots.length===1?'':'s'} loaded</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:12 }}>
          {months.map((m) => {
            const s = slotsByMonth.get(m.key) ?? [];
            const isOpen = openMonth === m.key;
            return (
              <div
                key={m.key}
                style={{
                  ...monthCard,
                  background: isOpen ? '#F5F1E6' : '#FFFFFF',
                  borderColor: isOpen ? PRIMARY : HAIR,
                }}
              >
                <button type="button"
                  onClick={() => setOpenMonth(isOpen ? null : m.key)}
                  style={{ background:'transparent', border:'none', textAlign:'left', width:'100%', padding:0, cursor:'pointer', fontFamily:'inherit' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                    <div style={{ fontWeight:700, fontSize:13, color:INK }}>{m.label}</div>
                    <div style={{ fontSize:11, color:INK_M }}>{s.length} slot{s.length===1?'':'s'}</div>
                  </div>
                </button>

                {s.length === 0 ? (
                  <div style={{ marginTop:6, fontSize:11, color:INK_M, fontStyle:'italic' }}>No slots.</div>
                ) : (
                  <ul style={{ margin:'6px 0 0', padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:4 }}>
                    {s.map((x) => {
                      const c = STATUS_COLOR[x.status];
                      return (
                        <li key={x.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:10, fontFamily:'ui-monospace, monospace', color:INK_M, minWidth:40 }}>{fmtDate(x.slot_date)}</span>
                          <button type="button" onClick={()=>{ setDrawerSlot(x); setRefineText(''); }}
                            style={{
                              flex:1, textAlign:'left', padding:'2px 6px', fontSize:11, fontWeight:600,
                              background:c.bg, color:c.fg, border:`1px solid ${c.brd}`, borderRadius:3, cursor:'pointer',
                              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'inherit',
                            }}
                            title={`${x.title} · ${x.status} · ${x.goal_tag}`}>
                            {x.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* DRAWER */}
      {drawerSlot && (
        <div role="dialog" aria-modal="true"
          onClick={(e)=> { if (e.target === e.currentTarget) setDrawerSlot(null); }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:1000, display:'flex', justifyContent:'flex-end' }}>
          <div style={{ width:540, maxWidth:'100%', height:'100%', background:'#FFFFFF', borderLeft:`1px solid ${HAIR}`, overflow:'auto', padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h4 style={{ margin:0, fontSize:14, color: INK, fontWeight:700 }}>Slot · {fmtDate(drawerSlot.slot_date)}</h4>
              <button onClick={()=>setDrawerSlot(null)} style={{ background:'transparent', border:'none', fontSize:20, cursor:'pointer', color:INK_M }}>×</button>
            </div>
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:INK }}>{drawerSlot.title}</div>
              <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>goal: <span style={{ fontFamily:'ui-monospace, monospace' }}>{drawerSlot.goal_tag}</span> · {drawerSlot.audience_type} · {drawerSlot.status}</div>
            </div>
            <div style={{ marginTop:12 }}>
              <div style={fieldLabel}>Subject</div>
              <div style={preBox}>{drawerSlot.subject ?? '—'}</div>
            </div>
            <div style={{ marginTop:12 }}>
              <div style={fieldLabel}>Body (markdown)</div>
              <div style={{ ...preBox, whiteSpace:'pre-wrap', maxHeight:280, overflow:'auto' }}>{drawerSlot.body_md ?? '—'}</div>
            </div>
            {drawerSlot.ai_notes && (
              <div style={{ marginTop:12 }}>
                <div style={fieldLabel}>AI notes</div>
                <div style={{ ...preBox, fontStyle:'italic', color:INK_M }}>{drawerSlot.ai_notes}</div>
              </div>
            )}

            <div style={{ marginTop:16, borderTop:`1px solid ${HAIR}`, paddingTop:12 }}>
              <div style={fieldLabel}>Refine with AI</div>
              <textarea value={refineText} onChange={e=>setRefineText(e.target.value)}
                placeholder="e.g., Tighten opener to 2 sentences, add a spa CTA"
                rows={3} style={{ width:'100%', border:`1px solid ${HAIR}`, borderRadius:4, padding:8, fontSize:12, fontFamily:'inherit', boxSizing:'border-box' }} />
              <div style={{ display:'flex', gap:8, marginTop:8, justifyContent:'flex-end' }}>
                <button onClick={()=>refineSlot(drawerSlot)} disabled={busy!=='' || !refineText.trim()} style={secondaryButton}>Refine</button>
                {drawerSlot.status !== 'scheduled' && drawerSlot.status !== 'sent' && !drawerSlot.linked_campaign_id && (
                  <>
                    <button onClick={()=>approveSlot(drawerSlot, false)} disabled={busy!==''} style={secondaryButton}>Approve as draft</button>
                    <button onClick={()=>approveSlot(drawerSlot, true)}  disabled={busy!==''} style={ctaButton}>Approve + schedule</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- styles ----------
const panel: CSSProperties = { border:`1px solid ${HAIR}`, borderRadius:6, background:'#FFFFFF', padding:16 };
const h3: CSSProperties    = { margin:'0 0 4px', fontSize:13, fontWeight:700, color:INK };
const muted: CSSProperties = { margin:'0 0 12px', fontSize:11, color:INK_M };
const monthCard: CSSProperties = { padding:10, border:`1px solid ${HAIR}`, borderRadius:6, fontFamily:'inherit' };
const goalChip: CSSProperties = { display:'inline-flex', alignItems:'center', padding:'4px 10px', border:`1px solid ${HAIR}`, borderRadius:20, background:'#FAFAF7', fontSize:12, color:INK };
const editLink: CSSProperties = { fontSize:11, color:PRIMARY, textDecoration:'none', fontWeight:600 };
const fieldWrap: CSSProperties = { display:'flex', flexDirection:'column', gap:4 };
const fieldLabel: CSSProperties = { fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', color:INK_M, fontWeight:600 };
const input: CSSProperties = { border:`1px solid ${HAIR}`, borderRadius:4, padding:'4px 8px', fontSize:12, fontFamily:'inherit' };
const infoBox: CSSProperties = { padding:8, background:'#EEF6EE', border:'1px solid #C9E1C9', color:'#1F5C2C', borderRadius:4, fontSize:12 };
const preBox: CSSProperties = { padding:10, border:`1px solid ${HAIR}`, borderRadius:4, fontSize:12, background:'#FAFAF7' };
const ctaButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:PRIMARY, color:'#FFFFFF', border:`1px solid ${PRIMARY}`, borderRadius:4, cursor:'pointer' };
const secondaryButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:PRIMARY, border:`1px solid ${HAIR}`, borderRadius:4, cursor:'pointer' };
