'use client';
// app/guest/newsletters/director/_components/DirectorClient.tsx
// PBS 2026-07-22 (Newsletter Engine v2): AI Editorial Director UI.
//
// Sections:
//   1. Goals editor (weight slider 0-10 per goal · Save on blur)
//   2. Generate 12-month plan (date range + regenerate-empty-only mode)
//   3. Month × week grid (12 months) — click month cell → drawer of slots
//   4. Slot drawer: preview · Refine (AI popover) · Approve (schedule at slot_date · 10:00)
//
// All writes go through fn_director_* SECURITY DEFINER RPCs via API routes.

import { Fragment, useMemo, useState, useTransition } from 'react';
import type { CSSProperties } from 'react';

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
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }); }
  catch { return iso; }
}
function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}

export default function DirectorClient({ propertyId, initialGoals, initialSlots }: Props) {
  const [goals, setGoals] = useState<GoalRow[]>(initialGoals);
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
    return m;
  }, [slots]);

  async function saveGoalWeight(goalKey: string, weight: number) {
    setBusy('goal');
    try {
      const g = goals.find(x => x.goal_key === goalKey);
      if (!g) return;
      const res = await fetch('/api/marketing/director/goal-upsert', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ property_id: propertyId, goal_key: goalKey, goal_label: g.goal_label, weight, active: g.active }),
      });
      if (!res.ok) { setMsg(`Save goal failed: ${await res.text()}`); return; }
      setGoals(prev => prev.map(x => x.goal_key===goalKey ? { ...x, weight } : x));
      setMsg('Goal saved.');
    } finally { setBusy(''); setTimeout(()=>setMsg(''), 2000); }
  }

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

      {/* GOALS EDITOR */}
      <section style={panel}>
        <h3 style={h3}>1 · Editorial goals · weights (0-10)</h3>
        <p style={muted}>Higher weight = more slots devoted to that goal in the AI plan.</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 60px 60px', gap:8, alignItems:'center' }}>
          {goals.map((g) => (
            <Fragment key={g.goal_key}>
              <label style={{ fontSize:12, color:INK }}>
                <span style={{ fontWeight:600 }}>{g.goal_label}</span>
                <span style={{ color: INK_M, marginLeft:8, fontFamily:'ui-monospace, monospace', fontSize:10 }}>{g.goal_key}</span>
              </label>
              <input
                type="range" min={0} max={10} step={1}
                defaultValue={g.weight}
                disabled={busy==='goal'}
                onMouseUp={(e) => saveGoalWeight(g.goal_key, Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => saveGoalWeight(g.goal_key, Number((e.target as HTMLInputElement).value))}
                style={{ width:'100%' }}
              />
              <span style={{ fontSize:12, fontVariantNumeric:'tabular-nums', textAlign:'right', color: g.weight===0?INK_M:INK }}>{g.weight}</span>
            </Fragment>
          ))}
        </div>
      </section>

      {/* GENERATE PLAN */}
      <section style={panel}>
        <h3 style={h3}>2 · Generate 12-month plan</h3>
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

      {/* MONTH GRID */}
      <section style={panel}>
        <h3 style={h3}>3 · 12-month calendar</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0, 1fr))', gap:8 }}>
          {months.map((m) => {
            const s = slotsByMonth.get(m.key) ?? [];
            const isOpen = openMonth === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setOpenMonth(isOpen ? null : m.key)}
                style={{
                  ...monthCell,
                  background: isOpen ? '#F5F1E6' : '#FFFFFF',
                  borderColor: isOpen ? PRIMARY : HAIR,
                }}
              >
                <div style={{ fontWeight:600, fontSize:12 }}>{m.label}</div>
                <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>{s.length} slot{s.length===1?'':'s'}</div>
                {s.length > 0 && (
                  <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:2 }}>
                    {s.map((x) => {
                      const c = STATUS_COLOR[x.status];
                      return <span key={x.id} title={`${x.title} (${x.status})`} style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:c.bg, border:`1px solid ${c.brd}` }} />;
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {openMonth && (
          <div style={{ marginTop:16, border:`1px solid ${HAIR}`, borderRadius:6, background:'#FFFFFF' }}>
            <div style={{ padding:'8px 12px', background:'#FAFAF7', borderBottom:`1px solid ${HAIR}`, fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', color:INK_M, fontWeight:600 }}>
              {months.find(x=>x.key===openMonth)?.label} · slots
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#FAFAF7', borderBottom:`1px solid ${HAIR}` }}>
                  <th style={th}>Date</th><th style={th}>Title</th><th style={th}>Goal</th><th style={th}>Audience</th><th style={th}>Status</th><th style={{...th, textAlign:'right', width:120}}></th>
                </tr>
              </thead>
              <tbody>
                {(slotsByMonth.get(openMonth) ?? []).map((s) => {
                  const c = STATUS_COLOR[s.status];
                  return (
                    <tr key={s.id} style={{ borderBottom:`1px solid ${HAIR}` }}>
                      <td style={tdL}>{fmtDate(s.slot_date)}</td>
                      <td style={{ ...tdL, fontWeight:500 }}>{s.title}</td>
                      <td style={tdL}><span style={{ fontFamily:'ui-monospace, monospace', fontSize:11 }}>{s.goal_tag}</span></td>
                      <td style={tdL}>{s.audience_type}</td>
                      <td style={tdL}>
                        <span style={{ padding:'2px 8px', fontSize:10, fontWeight:600, borderRadius:10, background:c.bg, color:c.fg, border:`1px solid ${c.brd}` }}>{s.status}</span>
                      </td>
                      <td style={{ ...tdR, textAlign:'right' }}>
                        <button onClick={()=>{ setDrawerSlot(s); setRefineText(''); }} style={actionBtnLight}>Open</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
const monthCell: CSSProperties = { textAlign:'left', padding:10, border:`1px solid ${HAIR}`, borderRadius:6, cursor:'pointer', fontFamily:'inherit' };
const fieldWrap: CSSProperties = { display:'flex', flexDirection:'column', gap:4 };
const fieldLabel: CSSProperties = { fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', color:INK_M, fontWeight:600 };
const input: CSSProperties = { border:`1px solid ${HAIR}`, borderRadius:4, padding:'4px 8px', fontSize:12, fontFamily:'inherit' };
const infoBox: CSSProperties = { padding:8, background:'#EEF6EE', border:'1px solid #C9E1C9', color:'#1F5C2C', borderRadius:4, fontSize:12 };
const preBox: CSSProperties = { padding:10, border:`1px solid ${HAIR}`, borderRadius:4, fontSize:12, background:'#FAFAF7' };
const ctaButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:PRIMARY, color:'#FFFFFF', border:`1px solid ${PRIMARY}`, borderRadius:4, cursor:'pointer' };
const secondaryButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:PRIMARY, border:`1px solid ${HAIR}`, borderRadius:4, cursor:'pointer' };
const actionBtnLight: CSSProperties = { padding:'4px 10px', fontSize:11, fontWeight:600, background:'#FFFFFF', color:'#3A3A3A', border:`1px solid ${HAIR}`, borderRadius:4, cursor:'pointer' };
const th: CSSProperties = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:INK, textAlign:'left' };
const tdL: CSSProperties = { padding:'8px 10px', fontSize:12, color:INK };
const tdR: CSSProperties = { padding:'8px 10px', fontSize:12, textAlign:'right' };
