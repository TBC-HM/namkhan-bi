'use client';
// components/goals/SharedGoalStack.tsx
// Shared goal stack component — one template for platform (L1/L2/L3) and property (big_goal/module_goal).
// variant='platform': slug required, no metric/target columns, review_cadence, DOC dot from spec briefs
// variant='property': module required, metric/baseline/target/deadline/guardrail columns, horizon
// Both use: same CSS tokens, same inline GoalForm, same status badges, same version + doc tracking.

import { Fragment, useState } from 'react';

// ──── Types ──────────────────────────────────────────────────────────────────

export type GoalGroup = {
  label: string;           // e.g. "L1 · Vision" or "Big Goal" or "Marketing"
  level_key: string;       // unique key for this group
  add_label: string;       // e.g. "+ Add L1 goal" or "+ Module goal"
  goals: SharedGoal[];
};

export type SharedGoal = {
  id: number;
  kind: string;            // 'l1'|'l2'|'l3'|'l4' for platform; 'big_goal'|'module_goal' for property
  parent_id: number | null;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  // platform-specific
  measurable_target?: string | null;
  review_cadence?: string | null;
  // property-specific
  module?: string | null;
  metric?: string | null;
  baseline?: number | null;
  target_value?: number | null;
  deadline?: string | null;
  weight?: number | null;
  guardrail_type?: string | null;
  horizon?: string | null;
  // shared traceability
  version?: string | null;
  last_edit?: string | null;
  doc_status?: 'green' | 'yellow' | 'red' | 'grey' | null;
};

// ──── Design tokens (CSS vars — work in cockpit and property layouts) ────────

const MONO = 'JetBrains Mono, ui-monospace, monospace';

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  proposed:   { bg: 'rgba(180,138,58,0.14)', fg: '#B48A3A' },
  active:     { bg: 'rgba(8,72,56,0.10)',    fg: 'var(--primary, #084838)' },
  ratified:   { bg: 'rgba(8,72,56,0.10)',    fg: 'var(--primary, #084838)' },
  achieved:   { bg: 'rgba(8,72,56,0.18)',    fg: 'var(--primary, #084838)' },
  abandoned:  { bg: 'rgba(90,90,90,0.12)',   fg: 'var(--ink-soft, #5A5A5A)' },
  superseded: { bg: 'rgba(90,90,90,0.12)',   fg: 'var(--ink-soft, #5A5A5A)' },
};

const DOC_COLOR: Record<string, string> = {
  green: 'var(--status-green, #0E7A4B)', yellow: 'var(--status-amber, #B48A3A)',
  red: 'var(--status-red, #B03826)', grey: 'var(--ink-soft, #5A5A5A)',
};

const GUARDRAIL_OPTS = [
  { value:'',label:'— none —' },
  { value:'floor',label:'Floor' },
  { value:'ceiling',label:'Ceiling' },
  { value:'approval_required',label:'Approval required' },
  { value:'watch',label:'Watch' },
];

const PROPERTY_MODULES = ['revenue','marketing','sales','finance','operations','guest','fnb','spa','activities','retreats','retail','transport','hr','administration'];
const HORIZON_OPTS = ['quarterly','annual','2_year','3_year','5_year'];

// ──── Sub-components ─────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.active;
  return <span style={{ fontSize:10, fontFamily:MONO, fontWeight:700, padding:'2px 8px', borderRadius:10, background:s.bg, color:s.fg, textTransform:'uppercase' as const }}>{status}</span>;
}

function DocDot({ color }: { color?: string | null }) {
  const c = DOC_COLOR[color ?? 'grey'] ?? DOC_COLOR.grey;
  return <span title={color ?? 'no doc'} style={{ display:'inline-block', width:9, height:9, borderRadius:'50%', background:c, flexShrink:0, verticalAlign:'middle' }} />;
}

const inp: React.CSSProperties = { width:'100%', fontSize:12.5, padding:'5px 8px', border:'1px solid var(--hairline,#E6DFCC)', borderRadius:6, background:'var(--paper,#FFF)', color:'var(--ink,#1B1B1B)' };
const lbl: React.CSSProperties = { fontSize:10.5, fontWeight:600, color:'var(--ink-soft,#5A5A5A)', textTransform:'uppercase' as const, letterSpacing:0.4, marginBottom:2, display:'block' };

function F({ label, span, children }: { label:string; span?:number; children:React.ReactNode }) {
  return <div style={{ gridColumn:span?`span ${span}`:undefined }}><span style={lbl}>{label}</span>{children}</div>;
}

type GoalDraft = {
  id: number|null; kind: string; parent_id: number|null;
  slug: string; title: string; description: string;
  measurable_target: string; review_cadence: string;
  module: string; metric: string; baseline: string; target_value: string;
  deadline: string; weight: string; guardrail_type: string; horizon: string;
};

function emptyDraft(kind: string, parent_id: number|null): GoalDraft {
  return { id:null, kind, parent_id, slug:'', title:'', description:'', measurable_target:'', review_cadence:'', module:'', metric:'', baseline:'', target_value:'', deadline:'', weight:'', guardrail_type:'', horizon:'annual' };
}
function toDraft(g: SharedGoal): GoalDraft {
  return { id:g.id, kind:g.kind, parent_id:g.parent_id, slug:g.slug, title:g.title, description:g.description??'', measurable_target:g.measurable_target??'', review_cadence:g.review_cadence??'', module:g.module??'', metric:g.metric??'', baseline:g.baseline!=null?String(g.baseline):'', target_value:g.target_value!=null?String(g.target_value):'', deadline:g.deadline?g.deadline.slice(0,10):'', weight:g.weight!=null?String(g.weight):'', guardrail_type:g.guardrail_type??'', horizon:g.horizon??'annual' };
}

function GoalForm({ draft, variant, onSave, onCancel }: {
  draft: GoalDraft; variant: 'platform'|'property';
  onSave: (d: GoalDraft) => Promise<void>; onCancel: () => void;
}) {
  const [d, setD] = useState<GoalDraft>(draft);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const s = (k: keyof GoalDraft, v: string) => setD(p => ({ ...p, [k]: v }));
  const isNew = d.id == null;

  async function submit() {
    if (!d.title.trim()) { setErr('title required'); return; }
    if (variant === 'platform' && isNew && !/^[a-z0-9][a-z0-9-]{1,79}$/.test(d.slug.trim())) { setErr('slug: lowercase + hyphens'); return; }
    if (variant === 'property' && d.kind === 'module_goal' && !d.module) { setErr('pick a module'); return; }
    setSaving(true); setErr('');
    try { await onSave(d); } catch(e) { setErr(String(e)); setSaving(false); }
  }

  return (
    <div style={{ border:'1px solid var(--hairline,#E6DFCC)', borderRadius:8, padding:'12px 14px', margin:'6px 0 10px', background:'rgba(8,72,56,0.03)' }}>
      <div style={{ fontSize:12, fontWeight:600, color:'var(--primary,#084838)', marginBottom:8 }}>
        {isNew ? `New ${d.kind.replace('_',' ')} goal` : `Editing: ${d.slug || d.title}`}
        {!isNew && variant==='platform' && d.kind.startsWith('l') && Number(d.kind[1]) <= 2 &&
          <span style={{ fontWeight:400, color:'var(--ink-soft,#5A5A5A)', marginLeft:8, fontSize:11 }}>material edits reset to PROPOSED</span>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {variant==='platform' && isNew && <F label="Slug"><input style={{...inp,fontFamily:MONO}} value={d.slug} placeholder="kebab-case" onChange={e=>s('slug',e.target.value)} /></F>}
        <F label="Title" span={variant==='platform'&&isNew?3:4}><input style={inp} value={d.title} onChange={e=>s('title',e.target.value)} /></F>
        <F label="Description" span={4}><textarea style={{...inp,resize:'vertical' as const}} rows={2} value={d.description} onChange={e=>s('description',e.target.value)} /></F>

        {variant==='platform' && <>
          <F label="Measurable target" span={3}><input style={{...inp,fontFamily:MONO}} value={d.measurable_target} placeholder="human-readable target" onChange={e=>s('measurable_target',e.target.value)} /></F>
          <F label="Cadence"><select style={inp} value={d.review_cadence} onChange={e=>s('review_cadence',e.target.value)}><option value="">—</option>{['continuous','weekly','monthly','quarterly','yearly'].map(c=><option key={c} value={c}>{c}</option>)}</select></F>
        </>}

        {variant==='property' && <>
          {d.kind==='module_goal' && <><F label="Module"><select style={inp} value={d.module} onChange={e=>s('module',e.target.value)}><option value="">—</option>{PROPERTY_MODULES.map(m=><option key={m} value={m}>{m}</option>)}</select></F>
          <F label="Metric"><input style={{...inp,fontFamily:MONO}} value={d.metric} placeholder="e.g. adr_usd" onChange={e=>s('metric',e.target.value)} /></F>
          <F label="Baseline"><input style={{...inp,fontFamily:MONO}} value={d.baseline} placeholder="today" onChange={e=>s('baseline',e.target.value)} /></F>
          <F label="Target"><input style={{...inp,fontFamily:MONO}} value={d.target_value} placeholder="number" onChange={e=>s('target_value',e.target.value)} /></F>
          <F label="Deadline"><input type="date" style={inp} value={d.deadline} onChange={e=>s('deadline',e.target.value)} /></F>
          <F label="Weight (1-10)"><input style={{...inp,fontFamily:MONO}} value={d.weight} placeholder="1-10" onChange={e=>s('weight',e.target.value)} /></F>
          <F label="Guardrail" span={2}><select style={inp} value={d.guardrail_type} onChange={e=>s('guardrail_type',e.target.value)}>{GUARDRAIL_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></F></>}
          <F label="Horizon" span={d.kind==='module_goal'?0:2}><select style={inp} value={d.horizon} onChange={e=>s('horizon',e.target.value)}>{HORIZON_OPTS.map(h=><option key={h} value={h}>{h.replace('_',' ')}</option>)}</select></F>
        </>}
      </div>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:10 }}>
        <button style={{ fontSize:12.5, fontWeight:650, padding:'6px 16px', borderRadius:6, cursor:'pointer', border:'1px solid var(--primary,#084838)', background:'var(--primary,#084838)', color:'var(--paper,#FFF)' }} onClick={submit} disabled={saving}>{saving?'Saving…':isNew?'Add goal':'Save'}</button>
        <button style={{ fontSize:12.5, fontWeight:600, padding:'6px 14px', borderRadius:6, cursor:'pointer', border:'1px solid var(--hairline,#E6DFCC)', background:'var(--paper,#FFF)', color:'var(--ink,#1B1B1B)' }} onClick={onCancel} disabled={saving}>Cancel</button>
        {err && <span style={{ fontSize:12, color:'var(--status-red,#B03826)' }}>{err}</span>}
      </div>
    </div>
  );
}

// ──── Main component ─────────────────────────────────────────────────────────

export function SharedGoalStack({ groups, variant, onSave }: {
  groups: GoalGroup[];
  variant: 'platform' | 'property';
  onSave: (draft: GoalDraft) => Promise<void>;
}) {
  const [editing, setEditing] = useState<number | null>(null);    // goal id being edited
  const [adding, setAdding] = useState<string | null>(null);      // group level_key for new goal
  const [addKind, setAddKind] = useState<string>('');
  const [addParent, setAddParent] = useState<number | null>(null);

  function startAdd(group: GoalGroup, kind: string, parent_id: number|null) {
    setEditing(null);
    setAdding(group.level_key);
    setAddKind(kind);
    setAddParent(parent_id);
  }

  async function handleSave(d: GoalDraft) {
    await onSave(d);
    setEditing(null); setAdding(null);
    window.location.reload();
  }

  return (
    <div>
      {groups.map(group => (
        <div key={group.level_key} style={{ border:'1px solid var(--hairline,#E6DFCC)', borderRadius:8, overflow:'hidden', marginBottom:14 }}>
          {/* Group header */}
          <div style={{ background:'var(--primary,#084838)', padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--paper,#FFF)' }}>{group.label}</span>
            <span style={{ fontSize:11, color:'rgba(255,255,255,.65)' }}>{group.goals.length} goal{group.goals.length!==1?'s':''}</span>
          </div>

          {/* Goals table */}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:12.5 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--hairline,#E6DFCC)', background:'rgba(0,0,0,.02)' }}>
                  {variant==='platform' && <th style={TH}>Slug</th>}
                  {variant==='property' && <th style={TH}>Module</th>}
                  <th style={{ ...TH, textAlign:'left' as const }}>Goal</th>
                  {variant==='property' && <><th style={TH}>Metric</th><th style={TH}>Target</th><th style={TH}>Deadline</th><th style={TH}>Horizon</th></>}
                  {variant==='platform' && <><th style={TH}>Version</th><th style={TH}>Last edit</th></>}
                  <th style={TH}>Doc</th>
                  <th style={{ ...TH, textAlign:'right' as const }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {group.goals.length===0 && (
                  <tr><td colSpan={10} style={{ padding:'12px 14px', color:'var(--ink-soft,#5A5A5A)', fontSize:12 }}>No goals in this group — add one below.</td></tr>
                )}
                {group.goals.map(g => (
                  <Fragment key={g.id}>
                    <tr style={{ borderBottom: editing===g.id?'none':'1px solid var(--hairline,#E6DFCC)', background: editing===g.id?'rgba(8,72,56,0.04)':'transparent' }}>
                      {variant==='platform' && <td style={{ ...TD, fontFamily:MONO, fontSize:11, color:'var(--ink-soft,#5A5A5A)', whiteSpace:'nowrap' as const }}>{g.slug}</td>}
                      {variant==='property' && <td style={{ ...TD, fontFamily:MONO, fontSize:11, color:'var(--ink-soft,#5A5A5A)', whiteSpace:'nowrap' as const }}>{g.module??'—'}</td>}
                      <td style={{ ...TD, maxWidth:320 }}>
                        <div style={{ fontWeight:500 }}>{g.title}</div>
                        {g.description && <div style={{ fontSize:11, color:'var(--ink-soft,#5A5A5A)', marginTop:1 }}>{g.description.slice(0,80)}{g.description.length>80?'…':''}</div>}
                        {g.measurable_target && <div style={{ fontSize:11, fontFamily:MONO, color:'var(--ink-soft,#5A5A5A)', marginTop:1 }}>{g.measurable_target}</div>}
                      </td>
                      {variant==='property' && <>
                        <td style={{ ...TD, fontFamily:MONO, fontSize:11 }}>{g.metric??'—'}</td>
                        <td style={{ ...TD, fontFamily:MONO, fontSize:11 }}>{g.target_value??'—'}</td>
                        <td style={{ ...TD, fontFamily:MONO, fontSize:11 }}>{g.deadline?g.deadline.slice(0,10):'—'}</td>
                        <td style={{ ...TD, fontSize:11, color:'var(--ink-soft,#5A5A5A)' }}>{g.horizon?.replace('_',' ')??'annual'}</td>
                      </>}
                      {variant==='platform' && <>
                        <td style={{ ...TD, fontFamily:MONO, fontSize:11, color:'var(--ink-soft,#5A5A5A)' }}>{g.version??'—'}</td>
                        <td style={{ ...TD, fontFamily:MONO, fontSize:11, color:'var(--ink-soft,#5A5A5A)' }}>{g.last_edit??'—'}</td>
                      </>}
                      <td style={{ ...TD, textAlign:'center' as const }}><DocDot color={g.doc_status} /></td>
                      <td style={{ ...TD, textAlign:'right' as const, whiteSpace:'nowrap' as const }}>
                        <StatusPill status={g.status} />
                        <button onClick={()=>{setAdding(null);setEditing(editing===g.id?null:g.id);}} style={{ ...BTN_GHOST, marginLeft:8, fontSize:11, padding:'2px 9px' }}>{editing===g.id?'Cancel':'Edit'}</button>
                      </td>
                    </tr>
                    {editing===g.id && (
                      <tr style={{ borderBottom:'1px solid var(--hairline,#E6DFCC)' }}>
                        <td colSpan={10} style={{ padding:'0 14px' }}>
                          <GoalForm draft={toDraft(g)} variant={variant} onSave={handleSave} onCancel={()=>setEditing(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add form or button */}
          <div style={{ padding:'10px 14px', borderTop:'1px solid var(--hairline,#E6DFCC)', background:'rgba(0,0,0,.01)' }}>
            {adding===group.level_key ? (
              <GoalForm draft={emptyDraft(addKind, addParent)} variant={variant} onSave={handleSave} onCancel={()=>setAdding(null)} />
            ) : (
              <button onClick={()=>startAdd(group, group.goals[0]?.kind??'module_goal', group.goals[0]?.parent_id??null)}
                style={{ ...BTN_GHOST, borderStyle:'dashed', color:'var(--primary,#084838)', fontSize:12 }}>{group.add_label}</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const TH: React.CSSProperties = { padding:'5px 10px', textAlign:'center' as const, fontSize:10.5, fontWeight:600, color:'var(--ink-soft,#5A5A5A)', whiteSpace:'nowrap' as const };
const TD: React.CSSProperties = { padding:'8px 10px', verticalAlign:'top' as const };
const BTN_GHOST: React.CSSProperties = { fontSize:12.5, fontWeight:600, padding:'4px 12px', borderRadius:6, cursor:'pointer', border:'1px solid var(--hairline,#E6DFCC)', background:'var(--paper,#FFF)', color:'var(--ink,#1B1B1B)' };
