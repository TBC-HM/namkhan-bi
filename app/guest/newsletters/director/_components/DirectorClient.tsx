'use client';
// app/guest/newsletters/director/_components/DirectorClient.tsx
// PBS 2026-07-21 pm (Newsletter Calendar v2 · per-group flow):
//   - Group selector (All + one entry per marketing.subscriber_groups)
//   - Date range + cadence-per-week input
//   - Monthly grid coloured by group_color (dots when All; solid tint when specific)
//   - Legend below calendar
//   - Slot drawer: Refine · Reject (=skip) · Accept (creates guest.campaigns draft
//     via /api/marketing/director/accept-slot, toast + link to editor)
//   - Preserved: Goals editor (weights) + Refine popover, Bulk approve.

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
  group_slug?: string | null;
  parent_plan_run_id?: string | null;
  group_name?: string | null;
  group_color?: string | null;
}
export interface GroupRow { slug: string; name: string; color: string | null; sort_order: number | null }

interface Props {
  propertyId: number;
  initialGoals: GoalRow[];
  initialSlots: SlotRow[];
  groups: GroupRow[];
}

const HAIR = '#E6DFCC';
const INK  = '#1B1B1B';
const INK_M = '#5A5A5A';
const PRIMARY = '#1F3A2E';
const DEFAULT_GROUP_COLOR = '#7A4B2A';
const UNASSIGNED_COLOR = '#B0A48C';

const STATUS_BADGE: Record<SlotRow['status'], { bg: string; fg: string; brd: string }> = {
  proposed:  { bg:'#F5EAD9', fg:'#8B5A1C', brd:'#E8C89B' },
  refined:   { bg:'#E4EAF1', fg:'#1F3A5C', brd:'#A0B4CF' },
  approved:  { bg:'#E4F1E0', fg:'#1F5C2C', brd:'#A9CFA0' },
  scheduled: { bg:'#E4F1E0', fg:'#1F5C2C', brd:'#A9CFA0' },
  sent:      { bg:'#EEEEEE', fg:'#3A3A3A', brd:'#DDDDDD' },
  skipped:   { bg:'#FBE8E4', fg:'#8A2419', brd:'#E8B7AB' },
};

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }); }
  catch { return iso; }
}
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#','');
  const bigint = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function DirectorClient({ propertyId, initialGoals, initialSlots, groups }: Props) {
  const [goals, setGoals] = useState<GoalRow[]>(initialGoals);
  const [slots, setSlots] = useState<SlotRow[]>(initialSlots);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  });
  const [drawerSlot, setDrawerSlot] = useState<SlotRow | null>(null);
  const [refineText, setRefineText] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [msg, setMsg] = useState<string>('');
  const [toast, setToast] = useState<{ text: string; href?: string } | null>(null);
  const [genFrom, setGenFrom] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [genTo, setGenTo] = useState<string>('2026-12-31');
  const [cadencePerMonth, setCadencePerMonth] = useState<number>(4);
  const [genDirection, setGenDirection] = useState<string>('');
  const [regenerateEmptyOnly, setRegenerateEmptyOnly] = useState(true);
  const [groupFilter, setGroupFilter] = useState<string>('all'); // 'all' | slug
  const [, startT] = useTransition();

  const groupsBySlug = useMemo(() => {
    const m = new Map<string, GroupRow>();
    for (const g of groups) m.set(g.slug, g);
    return m;
  }, [groups]);

  function colorForSlot(s: SlotRow): string {
    if (s.group_color) return s.group_color;
    if (s.group_slug) return groupsBySlug.get(s.group_slug)?.color ?? DEFAULT_GROUP_COLOR;
    return UNASSIGNED_COLOR;
  }
  function labelForSlot(s: SlotRow): string {
    if (s.group_name) return s.group_name;
    if (s.group_slug) return groupsBySlug.get(s.group_slug)?.name ?? s.group_slug;
    return 'Unassigned';
  }

  const filteredSlots = useMemo(() => {
    if (groupFilter === 'all') return slots;
    return slots.filter(s => (s.group_slug ?? '') === groupFilter);
  }, [slots, groupFilter]);

  // Groups that actually appear in current slots (for the legend)
  const legendGroups = useMemo(() => {
    const seen = new Set<string>();
    for (const s of filteredSlots) seen.add(s.group_slug ?? '__unassigned__');
    const out: { slug: string; name: string; color: string }[] = [];
    for (const slug of seen) {
      if (slug === '__unassigned__') { out.push({ slug: '__unassigned__', name: 'Unassigned', color: UNASSIGNED_COLOR }); continue; }
      const g = groupsBySlug.get(slug);
      out.push({ slug, name: g?.name ?? slug, color: g?.color ?? DEFAULT_GROUP_COLOR });
    }
    return out.sort((a,b) => a.name.localeCompare(b.name));
  }, [filteredSlots, groupsBySlug]);

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
    const label = groupFilter === 'all' ? 'all groups' : (groupsBySlug.get(groupFilter)?.name ?? groupFilter);
    setMsg(`Generating plan for ${label} — this can take 30-60s…`);
    try {
      const res = await fetch('/api/marketing/director/generate-plan', {
        method: 'POST', headers: {'content-type':'application/json'},
        body: JSON.stringify({
          property_id: propertyId,
          start_date: genFrom,
          end_date: genTo,
          cadence_per_week: cadencePerMonth / 4.33,   // convert month → week for the backend
          group_slug: groupFilter === 'all' ? null : groupFilter,
          audience_types: ['b2c'],
          regenerate_empty_only: regenerateEmptyOnly,
          direction: genDirection.trim() || null,     // optional hint for later auto-compose
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

  async function acceptSlot(slot: SlotRow) {
    setBusy('accept');
    try {
      const res = await fetch('/api/marketing/director/accept-slot', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ slot_id: slot.id }),
      });
      if (!res.ok) { setMsg(`Accept failed: ${await res.text()}`); return; }
      const j = await res.json();
      const updated: SlotRow = { ...slot, status: 'approved', linked_campaign_id: j.campaign_id ?? slot.linked_campaign_id };
      setSlots(prev => prev.map(x => x.id===slot.id ? updated : x));
      setDrawerSlot(null);
      setToast({ text: 'Moved to Broadcasts draft. Click to edit.', href: j.edit_url ?? `/guest/newsletters/${j.campaign_id}` });
      setTimeout(() => setToast(null), 8000);
    } finally { setBusy(''); }
  }

  async function rejectSlot(slot: SlotRow) {
    setBusy('reject');
    try {
      // Approve endpoint's inverse — we mark status='skipped' via a slot-upsert with same key.
      const res = await fetch('/api/marketing/director/reject-slot', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ slot_id: slot.id }),
      });
      if (!res.ok) { setMsg(`Reject failed: ${await res.text()}`); return; }
      const updated: SlotRow = { ...slot, status: 'skipped', updated_at: new Date().toISOString() };
      setSlots(prev => prev.map(x => x.id===slot.id ? updated : x));
      setDrawerSlot(updated);
      setMsg('Slot rejected.');
    } finally { setBusy(''); setTimeout(()=>setMsg(''), 2000); }
  }

  // AI regenerate · runs the same compose pipeline as the autocompose cron for a single slot.
  // Calls the propose-one route (Claude) with slot context, then persists via refine-slot.
  async function regenerateSlot(slot: SlotRow) {
    setBusy('regenerate');
    setMsg(`Regenerating slot for ${new Date(slot.slot_date).toLocaleDateString('en-GB')}…`);
    try {
      const seed = [
        `Newsletter target date: ${slot.slot_date}`,
        slot.group_slug ? `Audience group: ${slot.group_slug}` : null,
        slot.title ? `Working title: ${slot.title}` : null,
        slot.goal_tag ? `Editorial goal: ${slot.goal_tag}` : null,
        slot.ai_notes ? `Notes: ${slot.ai_notes}` : null,
      ].filter(Boolean).join('\n');
      const r = await fetch('/api/marketing/newsletter/propose-one', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({
          property_id: propertyId,
          kind: 'broadcast',
          seed_text: seed,
          target_date: slot.slot_date,
          audience_type: slot.audience_type,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.proposal?.subject || !j?.proposal?.body_md) {
        setMsg(`Regenerate failed: ${j?.error ?? r.status}`); return;
      }
      const rr = await fetch('/api/marketing/director/refine-slot', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({
          slot_id: slot.id,
          instruction: 'regenerated from Needs review',
          subject_override: j.proposal.subject,
          body_md_override: j.proposal.body_md,
        }),
      });
      if (!rr.ok) { setMsg(`Save failed: ${await rr.text()}`); return; }
      const updated: SlotRow = {
        ...slot,
        subject: j.proposal.subject,
        body_md: j.proposal.body_md,
        status: 'refined',
        updated_at: new Date().toISOString(),
      };
      setSlots(prev => prev.map(x => x.id===slot.id ? updated : x));
      setMsg('Slot regenerated.');
    } finally { setBusy(''); setTimeout(()=>setMsg(''), 2500); }
  }

  async function bulkAccept(schedule: boolean) {
    setBusy('bulk');
    try {
      const res = await fetch('/api/marketing/director/bulk-accept', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({
          property_id: propertyId,
          from: genFrom, to: genTo,
          group_slug: groupFilter === 'all' ? null : groupFilter,
          schedule,
        }),
      });
      if (!res.ok) { setMsg(`Bulk accept failed: ${await res.text()}`); return; }
      const j = await res.json();
      setMsg(`Accepted ${j.accepted_count ?? j.approved_count ?? 0} slots.`);
      startT(() => { window.location.reload(); });
    } finally { setBusy(''); }
  }

  return (
    <div style={{ display:'grid', gap:24 }}>
      {msg && <div style={infoBox}>{msg}</div>}
      {toast && (
        <div style={toastBox}>
          <span>{toast.text}</span>
          {toast.href && <a href={toast.href} style={toastLink}>Open draft →</a>}
        </div>
      )}

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

      {/* GENERATE PLAN — per group */}
      <section style={panel}>
        <h3 style={h3}>2 · Generate plan for a group</h3>
        <div style={{ display:'flex', gap:12, alignItems:'end', flexWrap:'wrap' }}>
          <label style={fieldWrap}>
            <span style={fieldLabel}>Group</span>
            <select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} style={input}>
              <option value="all">All groups</option>
              {groups.map((g) => (
                <option key={g.slug} value={g.slug}>{g.name}</option>
              ))}
            </select>
          </label>
          <label style={fieldWrap}>
            <span style={fieldLabel}>From</span>
            <input type="date" value={genFrom} onChange={e=>setGenFrom(e.target.value)} style={input} />
          </label>
          <label style={fieldWrap}>
            <span style={fieldLabel}>To</span>
            <input type="date" value={genTo} onChange={e=>setGenTo(e.target.value)} style={input} />
          </label>
          <label style={fieldWrap}>
            <span style={fieldLabel}>Cadence / month</span>
            <input type="number" min={0} max={30} step={0.5} value={cadencePerMonth}
              onChange={e=>setCadencePerMonth(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
              style={{ ...input, width:80 }} />
          </label>
          <label style={{ fontSize:12, color: INK, display:'flex', alignItems:'center', gap:4 }}>
            <input type="checkbox" checked={regenerateEmptyOnly} onChange={e=>setRegenerateEmptyOnly(e.target.checked)} />
            Only fill empty slots
          </label>
        </div>
        <label style={{ ...fieldWrap, marginTop:12 }}>
          <span style={fieldLabel}>Direction / hints (optional)</span>
          <textarea value={genDirection} onChange={e=>setGenDirection(e.target.value)}
            rows={2}
            placeholder="e.g. focus this batch on Green Season fill · lean B2B partnership · include a new-year retreat push"
            style={{ ...input, width:'100%', fontFamily:'inherit', boxSizing:'border-box' }}
          />
        </label>
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button onClick={generatePlan} disabled={busy!==''} style={ctaButton}>
            {busy==='generate'
              ? 'Generating…'
              : `✨ Generate plan for ${groupFilter==='all' ? 'all groups' : (groupsBySlug.get(groupFilter)?.name ?? groupFilter)}`}
          </button>
          <button onClick={()=>bulkAccept(false)} disabled={busy!==''} style={secondaryButton}>Bulk accept range</button>
        </div>
      </section>

      {/* REVIEW QUEUE — drafts within 14d needing PBS attention */}
      {(() => {
        const now = Date.now();
        const in14d = now + 14 * 24 * 3600 * 1000;
        const needsReview = filteredSlots.filter(s => {
          const t = new Date(s.slot_date).getTime();
          if (isNaN(t) || t < now || t > in14d) return false;
          return s.status === 'proposed' || s.status === 'refined';
        }).sort((a,b) => a.slot_date.localeCompare(b.slot_date));
        if (needsReview.length === 0) return null;
        return (
          <section style={panel}>
            <h3 style={h3}>Needs review · next 14 days <span style={{ color:INK_M, fontWeight:500, fontSize:11, marginLeft:6 }}>({needsReview.length})</span></h3>
            <p style={muted}>Auto-composed by Director. Approve or refine before scheduled send.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {needsReview.slice(0, 8).map(s => {
                const c = STATUS_BADGE[s.status];
                return (
                  <div key={s.id}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', border:`1px solid ${HAIR}`, borderRadius:4, background:'#FFFFFF' }}>
                    <span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:colorForSlot(s), border:`1px solid ${HAIR}`, flexShrink:0 }} />
                    <span style={{ fontSize:11, color:INK_M, minWidth:70 }}>{fmtDate(s.slot_date)}</span>
                    <button type="button" onClick={()=>{ setDrawerSlot(s); setRefineText(''); }}
                      title="Open slot"
                      style={{ fontSize:12, fontWeight:500, color:INK, flex:1, background:'transparent', border:'none', textAlign:'left', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
                      {s.title}
                    </button>
                    <span style={{ fontSize:10, color:INK_M }}>{labelForSlot(s)}</span>
                    <span style={{ padding:'2px 8px', fontSize:10, fontWeight:600, borderRadius:10, background:c.bg, color:c.fg, border:`1px solid ${c.brd}` }}>{s.status}</span>
                    <button type="button" onClick={()=>regenerateSlot(s)} disabled={busy!==''}
                      title="AI regenerate subject + body"
                      style={{ padding:'4px 8px', fontSize:11, fontWeight:600, background:'#FFFFFF', color:PRIMARY, border:`1px solid ${HAIR}`, borderRadius:4, cursor:'pointer' }}>
                      ✨ Regenerate
                    </button>
                    <button type="button" onClick={()=>rejectSlot(s)} disabled={busy!==''}
                      title="Dismiss — mark as skipped, won't be sent"
                      style={{ padding:'4px 8px', fontSize:11, fontWeight:600, background:'#FFFFFF', color:'#8A2419', border:`1px solid #E8B7AB`, borderRadius:4, cursor:'pointer' }}>
                      🗑 Dismiss
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* MONTHLY CALENDAR — real week grid */}
      <section style={panel}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h3 style={h3}>3 · Calendar {groupFilter!=='all' && <span style={{ color:INK_M, fontWeight:500, fontSize:11, marginLeft:6 }}>· {groupsBySlug.get(groupFilter)?.name}</span>}</h3>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button type="button" onClick={()=>{
              const d = new Date(currentMonth); d.setUTCMonth(d.getUTCMonth()-1);
              setCurrentMonth(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
            }} style={navBtn}>◀</button>
            <span style={{ fontSize:13, fontWeight:600, color:INK, minWidth:130, textAlign:'center' }}>
              {currentMonth.toLocaleDateString('en-GB', { month:'long', year:'numeric', timeZone:'UTC' })}
            </span>
            <button type="button" onClick={()=>{
              const d = new Date(currentMonth); d.setUTCMonth(d.getUTCMonth()+1);
              setCurrentMonth(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
            }} style={navBtn}>▶</button>
            <button type="button" onClick={()=>{
              const d = new Date(); setCurrentMonth(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
            }} style={{...navBtn, marginLeft:6}}>Today</button>
          </div>
        </div>

        {/* Weekday headers · Mon-first */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(0, 1fr))', gap:6, marginBottom:4 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', color:INK_M, fontWeight:600, padding:'4px 6px' }}>{d}</div>
          ))}
        </div>

        {/* Week grid · 6 rows × 7 cols */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(0, 1fr))', gap:6 }}>
          {(() => {
            const year = currentMonth.getUTCFullYear();
            const month = currentMonth.getUTCMonth();
            const firstOfMonth = new Date(Date.UTC(year, month, 1));
            // Monday-first: shift so Monday=0
            const dow = (firstOfMonth.getUTCDay() + 6) % 7;
            const gridStart = new Date(Date.UTC(year, month, 1 - dow));
            const cells: Array<{ date: Date; iso: string; inMonth: boolean }> = [];
            for (let i = 0; i < 42; i++) {
              const d = new Date(gridStart); d.setUTCDate(gridStart.getUTCDate() + i);
              cells.push({
                date: d,
                iso: d.toISOString().slice(0,10),
                inMonth: d.getUTCMonth() === month,
              });
            }
            // Precompute slots per iso date for O(1) lookup
            const byDate = new Map<string, SlotRow[]>();
            for (const s of filteredSlots) {
              const k = s.slot_date;
              if (!byDate.has(k)) byDate.set(k, []);
              byDate.get(k)!.push(s);
            }
            const today = new Date().toISOString().slice(0,10);
            return cells.map(cell => {
              const daySlots = byDate.get(cell.iso) ?? [];
              const isToday = cell.iso === today;
              return (
                <div key={cell.iso} style={{
                  minHeight: 92,
                  border: `1px solid ${isToday ? PRIMARY : HAIR}`,
                  borderRadius: 4,
                  padding: 6,
                  background: cell.inMonth ? '#FFFFFF' : '#FAFAF7',
                  display: 'flex', flexDirection: 'column', gap: 3,
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: !cell.inMonth ? '#B0A48C' : (isToday ? PRIMARY : INK),
                  }}>{cell.date.getUTCDate()}</div>
                  {daySlots.map(s => {
                    const c = STATUS_BADGE[s.status];
                    return (
                      <button key={s.id} onClick={()=>{ setDrawerSlot(s); setRefineText(''); }}
                        title={`${s.title} · ${labelForSlot(s)} · ${s.status}`}
                        style={{
                          textAlign:'left', border:`1px solid ${c.brd}`, borderRadius:3,
                          background: hexToRgba(colorForSlot(s), 0.12), padding:'3px 5px',
                          cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontFamily:'inherit', width:'100%',
                        }}>
                        <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:colorForSlot(s), flexShrink:0 }} />
                        <span style={{ fontSize:10, color:INK, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.title}</span>
                      </button>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>

        {/* LEGEND */}
        {legendGroups.length > 0 && (
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginTop:14, paddingTop:12, borderTop:`1px dashed ${HAIR}` }}>
            {legendGroups.map(lg => (
              <span key={lg.slug} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, color:INK_M }}>
                <span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background: lg.color, border:`1px solid ${HAIR}` }} />
                {lg.name}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* DRAWER (SlotPreviewDrawer role) */}
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
              <div style={{ fontSize:11, color:INK_M, marginTop:2, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                  <span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background: colorForSlot(drawerSlot), border:`1px solid ${HAIR}` }} />
                  {labelForSlot(drawerSlot)}
                </span>
                <span>· goal: <span style={{ fontFamily:'ui-monospace, monospace' }}>{drawerSlot.goal_tag}</span></span>
                <span>· {drawerSlot.audience_type}</span>
                <span>· {drawerSlot.status}</span>
              </div>
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
              <div style={{ display:'flex', gap:8, marginTop:8, justifyContent:'flex-end', flexWrap:'wrap' }}>
                <button onClick={()=>refineSlot(drawerSlot)} disabled={busy!=='' || !refineText.trim()} style={secondaryButton}>Refine</button>
                {drawerSlot.status !== 'sent' && drawerSlot.status !== 'skipped' && (
                  <button onClick={()=>rejectSlot(drawerSlot)} disabled={busy!==''} style={rejectButton}>Reject</button>
                )}
                {drawerSlot.status !== 'scheduled' && drawerSlot.status !== 'sent' && !drawerSlot.linked_campaign_id && (
                  <button onClick={()=>acceptSlot(drawerSlot)} disabled={busy!==''} style={ctaButton}>Accept</button>
                )}
                {drawerSlot.linked_campaign_id && (
                  <a href={`/guest/newsletters/${drawerSlot.linked_campaign_id}`} style={ctaButton as CSSProperties}>Open draft →</a>
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
const fieldWrap: CSSProperties = { display:'flex', flexDirection:'column', gap:4 };
const fieldLabel: CSSProperties = { fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', color:INK_M, fontWeight:600 };
const input: CSSProperties = { border:`1px solid ${HAIR}`, borderRadius:4, padding:'4px 8px', fontSize:12, fontFamily:'inherit' };
const infoBox: CSSProperties = { padding:8, background:'#EEF6EE', border:'1px solid #C9E1C9', color:'#1F5C2C', borderRadius:4, fontSize:12 };
const toastBox: CSSProperties = { padding:10, background:'#E4F1E0', border:'1px solid #A9CFA0', color:'#1F5C2C', borderRadius:4, fontSize:12, display:'flex', gap:12, alignItems:'center', justifyContent:'space-between' };
const toastLink: CSSProperties = { color:PRIMARY, fontWeight:700, textDecoration:'underline' };
const preBox: CSSProperties = { padding:10, border:`1px solid ${HAIR}`, borderRadius:4, fontSize:12, background:'#FAFAF7' };
const ctaButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:PRIMARY, color:'#FFFFFF', border:`1px solid ${PRIMARY}`, borderRadius:4, cursor:'pointer', textDecoration:'none', display:'inline-block' };
const secondaryButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:PRIMARY, border:`1px solid ${HAIR}`, borderRadius:4, cursor:'pointer' };
const rejectButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:'#8A2419', border:`1px solid #E8B7AB`, borderRadius:4, cursor:'pointer' };
const navBtn: CSSProperties = { padding:'4px 10px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:INK, border:`1px solid ${HAIR}`, borderRadius:4, cursor:'pointer', fontFamily:'inherit' };
