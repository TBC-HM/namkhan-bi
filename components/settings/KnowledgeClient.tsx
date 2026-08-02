'use client';

// components/settings/KnowledgeClient.tsx
// UX: collapsible questions with status badge (✓ answered / ⚠ needs work / ○ empty),
// version + last edit inline, GoalForm renders inside each big goal card.

import { useMemo, useState } from 'react';

export type TenantGoalRow = { goal_id: number; property_id: number; kind: 'big_goal' | 'module_goal'; parent_goal_id: number | null; module: string | null; title: string; description: string | null; metric: string | null; baseline: number | null; target_value: number | null; deadline: string | null; weight: number | null; guardrail_type: string | null; status: string; updated_at: string; };
export type KnowledgeAnswerRow = { section: string; question: string; answer: string | null; answered_by: string | null; updated_at: string; };
export type KnowledgeDocRow = { doc_id: number; section: string; version: number; status: string; content_md: string; owner_comments: string | null; drafted_by: string | null; decided_by: string | null; decided_at: string | null; updated_at: string; };

const MONO = 'JetBrains Mono, ui-monospace, monospace';
export const MODULES = ['revenue','marketing','sales','finance','operations','guest','fnb','spa','hr','administration'] as const;
export const GUARDRAIL_TYPES = [{ value:'',label:'— none —' },{ value:'floor',label:'Floor — never go below this number' },{ value:'ceiling',label:'Ceiling — never go above this number' },{ value:'approval_required',label:'Approval required — agents must ask before acting on it' },{ value:'watch',label:'Watch — alert me when it moves, no hard limit' }];

export const JUDGMENT_SECTIONS: Array<{ slug: string; label: string; intro: string; questions: string[] }> = [
  { slug:'revenue_philosophy', label:'Revenue Philosophy', intro:'How you want pricing decisions made when nobody is watching.', questions:['When the hotel is nearly empty in low season, do you prefer holding rates (protect the brand) or discounting to fill rooms (protect cash)? Where is the line?','Which guests or channels would you rather turn away than discount for?','How far in advance do you want rates locked vs. left flexible for last-minute moves?','What is the one revenue mistake you never want repeated?']},
  { slug:'playbook', label:'Commercial Playbook', intro:'The moves you actually make through the year.', questions:['What are the 3-4 commercial moments of your year (fairs, festivals, seasons) and what do you do around each?','When a big group asks for a quote, what do you always include and what do you never give away?','Which partnerships (DMCs, agents, hotels) matter most and how are they treated differently?']},
  { slug:'positioning', label:'Brand & Competitive Positioning', intro:'Who you are against, and what makes a guest pick you.', questions:['Which 3-5 properties do you actually lose guests to, and why do guests pick them?','What do you offer that none of them can copy?','What would you never do even if competitors do it and it works for them?']},
  { slug:'guest_profile', label:'Guest Profile', intro:'Who the right guest is — and who is not.', questions:['Describe your ideal guest in one paragraph: who they are, why they come, what they spend on.','Which guest types create the most problems or cost relative to what they pay?','What should every staff member and agent know about how your guests want to be treated?']},
  { slug:'escalation_crisis', label:'Escalation & Crisis', intro:'What reaches you, and what never should.', questions:['Which situations must reach you personally, day or night (money amount, guest type, incident kind)?','Who decides what when you are unreachable for 48 hours?','In a public complaint or press situation, what is the standing rule until you weigh in?']},
  { slug:'compliance', label:'Compliance Additions', intro:'Local rules and promises the platform must never break.', questions:['Are there local rules, licenses or agreements (beyond standard law) that limit what the hotel may sell, say or do?','Any standing promises to owners, banks or partners that agents must respect (reporting, caps, exclusivities)?']},
  { slug:'activities', label:'Activities & Experiences', intro:'What guests do here, how it is sold, and what the team needs to know.',
    questions:['Which 3-4 activities are most signature to The Namkhan — and why can guests only have them here?','How are activities sold: included in the rate, priced separately, or bundled into packages? What is never discounted?','What happens when a guest requests an experience not on the standard menu?','What must every guide and activity host know about your guests before any session begins?']},
  { slug:'retreats', label:'Retreats & Groups', intro:'How retreat programmes are built, sold, and delivered.',
    questions:['Describe your ideal 5-night retreat programme from arrival to departure — what does each day look like?','Which retreat elements are non-negotiable (always included) and which can the organiser customise?','How do you handle a retreat organiser who wants to change the programme after the contract is signed?','What makes a Namkhan retreat fundamentally different from a group that simply books the same rooms as transient guests?']},
  { slug:'fnb_ops', label:'Food & Beverage (Roots)', intro:'The Roots restaurant concept, kitchen rules, and F&B operating standards.',
    questions:['How would you describe Roots to a first-time guest in two sentences?','What are the standing rules on dietary restrictions — what can the kitchen always handle, what needs advance notice, and what cannot be accommodated?','When can a group book Roots exclusively, and what are the buyout terms?','What comes from the organic farm, what must be sourced externally, and who approves the sourcing?']},
  { slug:'spa_ops', label:'Jungle Spa', intro:'Treatments, booking rules, and what makes the spa a Namkhan signature.',
    questions:['Which treatments are most signature to the Jungle Spa, and which do you most want guests to experience?','Who can use the Jungle Spa — in-house guests only, or day visitors too? What are the rules?','Is advance booking required or are walk-ins accepted? What is the cancellation policy?','Are any treatments, oils, or products exclusive to The Namkhan — cannot be found elsewhere?']},
  { slug:'transport_ops', label:'Transport & Transfers', intro:'What the property operates, what it coordinates, and the standing rules.',
    questions:['What transport services does The Namkhan operate or coordinate (shuttle, boat, tuk-tuk, private car)?','Which services are complimentary and which are charged — at what rates?','What are the rules for the I-Mekong boat: minimum booking, maximum guests, what is included?','When a guest needs an airport transfer or private excursion, who handles it and what is the booking process?']},
  { slug:'retail_ops', label:'Retail', intro:'What we sell, the sourcing philosophy, and the standing rules.',
    questions:['What retail items does The Namkhan sell, and what is the philosophy behind the selection?','Which items are handmade on-site, which come from local artisans, and which are commercially sourced?','What is the pricing philosophy — community support pricing, standard retail markup, or guest premium?','Is there anything you would never sell or stock, even if guests regularly ask for it?']},
  { slug:'finance_ops', label:'Finance & Payments', intro:'Payment terms, currency rules, and what agents must never share.',
    questions:['What currencies are accepted and what is the deposit-to-balance payment schedule?','Do you invoice in USD, LAK, or both — and at what exchange rate or policy?','Who has authority to issue a refund or resolve a chargeback, and up to what amount?','What financial information must agents never share with guests (costs, margins, supplier rates)?']},
  { slug:'hr_ops', label:'People & Service Standards', intro:'How staff should behave, who can make decisions, and non-negotiables.',
    questions:['What are the 3 behaviours that result in immediate dismissal regardless of circumstance?','What must every guest-facing team member know about greeting, addressing, and reading guests?','Which team members have authority to make service recovery decisions (meal comp, upgrade, activity gift) and up to what value?','What is the standing rule on staff-guest personal relationships and social media?']},
];

const inp: React.CSSProperties = { width:'100%', fontSize:12.5, padding:'5px 8px', border:'1px solid var(--hairline)', borderRadius:6, background:'var(--paper)', color:'var(--ink)' };
const lbl: React.CSSProperties = { fontSize:10.5, fontWeight:600, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:0.4, marginBottom:2, display:'block' };
const btnP: React.CSSProperties = { fontSize:12.5, fontWeight:650, padding:'6px 16px', borderRadius:6, cursor:'pointer', border:'1px solid var(--primary)', background:'var(--primary)', color:'var(--paper)' };
const btnG: React.CSSProperties = { fontSize:12.5, fontWeight:600, padding:'6px 14px', borderRadius:6, cursor:'pointer', border:'1px solid var(--hairline)', background:'var(--paper)', color:'var(--ink)' };

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return <div style={{ gridColumn: span ? `span ${span}` : undefined }}><span style={lbl}>{label}</span>{children}</div>;
}
function GapBadge({ label, missing }: { label: string; missing: number }) {
  const done = missing === 0;
  return <span style={{ fontSize:11, fontFamily:MONO, fontWeight:700, padding:'2px 8px', borderRadius:10, background: done?'rgba(8,72,56,0.10)':'rgba(180,138,58,0.14)', color: done?'var(--primary)':'#B48A3A' }}>{label} {done?'✓':missing}</span>;
}

type GoalDraft = { goal_id: number|null; kind:'big_goal'|'module_goal'; parent_goal_id:number|null; module:string; title:string; description:string; metric:string; baseline:string; target_value:string; deadline:string; weight:string; guardrail_type:string; };
function emptyGoal(kind:'big_goal'|'module_goal', parentId:number|null): GoalDraft { return { goal_id:null, kind, parent_goal_id:parentId, module:'', title:'', description:'', metric:'', baseline:'', target_value:'', deadline:'', weight:'', guardrail_type:'' }; }
function goalToDraft(g: TenantGoalRow): GoalDraft { return { goal_id:g.goal_id, kind:g.kind, parent_goal_id:g.parent_goal_id, module:g.module??'', title:g.title, description:g.description??'', metric:g.metric??'', baseline:g.baseline!=null?String(g.baseline):'', target_value:g.target_value!=null?String(g.target_value):'', deadline:g.deadline?g.deadline.slice(0,10):'', weight:g.weight!=null?String(g.weight):'', guardrail_type:g.guardrail_type??'' }; }

function GoalForm({ draft, propertyId, onDone, onCancel }: { draft:GoalDraft; propertyId:number; onDone:()=>void; onCancel:()=>void }) {
  const [d,setD]=useState<GoalDraft>(draft); const [saving,setSaving]=useState(false); const [err,setErr]=useState('');
  const set=(k:keyof GoalDraft,v:string)=>setD(p=>({...p,[k]:v})); const isM=d.kind==='module_goal';
  async function save() {
    if(!d.title.trim()){setErr('title required');return;} if(isM&&!d.module){setErr('pick a module');return;}
    setSaving(true);setErr('');
    try { const res=await fetch('/api/settings/knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'goal_upsert',property_id:propertyId,goal:d})}); const j=await res.json().catch(()=>({})); if(!res.ok){setErr(j.error||'save failed');setSaving(false);return;} onDone(); } catch(e){setErr(String(e));setSaving(false);}
  }
  return (
    <div style={{ border:'1px solid var(--hairline)', borderRadius:8, padding:'12px 14px', margin:'8px 0', background:'rgba(8,72,56,0.03)' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        <Field label="Title" span={isM?2:4}><input style={inp} value={d.title} onChange={e=>set('title',e.target.value)} /></Field>
        {isM&&<><Field label="Module"><select style={inp} value={d.module} onChange={e=>set('module',e.target.value)}><option value="">—</option>{MODULES.map(m=><option key={m} value={m}>{m}</option>)}</select></Field><Field label="Metric"><input style={{...inp,fontFamily:MONO}} value={d.metric} placeholder="e.g. RGI, GOP %" onChange={e=>set('metric',e.target.value)} /></Field><Field label="Baseline (today)"><input style={{...inp,fontFamily:MONO}} value={d.baseline} placeholder="number" onChange={e=>set('baseline',e.target.value)} /></Field><Field label="Target"><input style={{...inp,fontFamily:MONO}} value={d.target_value} placeholder="number" onChange={e=>set('target_value',e.target.value)} /></Field><Field label="Deadline"><input type="date" style={inp} value={d.deadline} onChange={e=>set('deadline',e.target.value)} /></Field><Field label="Weight (1-10)"><input style={{...inp,fontFamily:MONO}} value={d.weight} placeholder="1-10" onChange={e=>set('weight',e.target.value)} /></Field><Field label="Guardrail" span={2}><select style={inp} value={d.guardrail_type} onChange={e=>set('guardrail_type',e.target.value)}>{GUARDRAIL_TYPES.map(g=><option key={g.value} value={g.value}>{g.label}</option>)}</select></Field></>}
        <Field label="Why this goal (context agents should know)" span={4}><textarea style={{...inp,resize:'vertical'}} rows={2} value={d.description} onChange={e=>set('description',e.target.value)} /></Field>
      </div>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:10 }}>
        <button style={btnP} onClick={save} disabled={saving}>{saving?'Saving…':'Save goal'}</button>
        <button style={btnG} onClick={onCancel} disabled={saving}>Cancel</button>
        {err&&<span style={{ fontSize:12, color:'var(--status-red)' }}>{err}</span>}
      </div>
    </div>
  );
}

const STCOL: Record<string,string> = { draft:'#B48A3A', approved:'var(--primary)', rejected:'var(--status-red)', superseded:'var(--ink-soft)' };

function JudgmentDocPanel({ propertyId, section, sectionLabel, docs }: { propertyId:number; section:string; sectionLabel:string; docs:KnowledgeDocRow[] }) {
  const latest=docs[0]??null; const latestDraft=latest&&latest.status==='draft'?latest:null; const latestApproved=docs.find(d=>d.status==='approved')??null;
  const [busy,setBusy]=useState(false); const [err,setErr]=useState(''); const [redline,setRedline]=useState<string|null>(null);
  const [rejectComment,setRejectComment]=useState(''); const [rejecting,setRejecting]=useState(false); const [showApproved,setShowApproved]=useState(false); const [showHistory,setShowHistory]=useState(false);
  async function post(payload:Record<string,unknown>):Promise<boolean> { setBusy(true);setErr(''); try { const res=await fetch('/api/settings/knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({property_id:propertyId,...payload})}); const j=await res.json().catch(()=>({})); if(!res.ok){setErr(j.error||'request failed');setBusy(false);return false;} return true; } catch(e){setErr(String(e));setBusy(false);return false;} }
  async function generateDraft(){if(await post({action:'doc_draft',section}))window.location.reload();}
  async function approve(){if(!latestDraft)return;if(await post({action:'doc_decide',doc_id:latestDraft.doc_id,decision:'approved',content_md:redline??latestDraft.content_md}))window.location.reload();}
  async function reject(){if(!latestDraft)return;if(!rejectComment.trim()){setErr('add a short comment');return;}if(await post({action:'doc_decide',doc_id:latestDraft.doc_id,decision:'rejected',comments:rejectComment}))window.location.reload();}
  return (
    <div style={{ border:'1px solid var(--hairline)', borderRadius:8, padding:'10px 12px', marginTop:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, fontWeight:650 }}>{sectionLabel} — document</span>
        {latest?(<span style={{ fontSize:11, fontFamily:MONO, fontWeight:700, color:STCOL[latest.status]??'var(--ink-soft)' }}>v{latest.version} · {latest.status}</span>):(<span style={{ fontSize:11, fontFamily:MONO, color:'var(--ink-soft)' }}>no document yet</span>)}
        {docs.length>1&&<button style={{...btnG,fontSize:11,padding:'2px 8px'}} onClick={()=>setShowHistory(v=>!v)}>{showHistory?'hide history':`history (${docs.length})`}</button>}
        {err&&<span style={{ fontSize:11.5, color:'var(--status-red)' }}>{err}</span>}
      </div>
      {showHistory&&<div style={{ margin:'6px 0' }}>{docs.map(d=><div key={d.doc_id} style={{ fontSize:11, fontFamily:MONO, color:'var(--ink-soft)', padding:'1px 0' }}>v{d.version} · <span style={{ color:STCOL[d.status]??'var(--ink-soft)' }}>{d.status}</span>{' · '}{(d.decided_at??d.updated_at)?.slice(0,10)}{d.status==='rejected'&&d.owner_comments?` · "${d.owner_comments.slice(0,80)}"`:''}</div>)}</div>}
      {latestDraft?(
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:11.5, color:'var(--ink-soft)', marginBottom:4 }}>Draft written from your answers. Edit it directly below — your edits are what gets approved. Nothing reaches agents until you approve.</div>
          <textarea value={redline??latestDraft.content_md} onChange={e=>setRedline(e.target.value)} rows={14} style={{...inp,fontFamily:MONO,fontSize:12,lineHeight:1.5,resize:'vertical'}} />
          <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:8, flexWrap:'wrap' }}>
            <button style={btnP} onClick={approve} disabled={busy}>{busy?'Working…':'Approve & publish'}</button>
            {!rejecting?(<button style={btnG} onClick={()=>setRejecting(true)} disabled={busy}>Reject…</button>):(<><input style={{...inp,width:320}} placeholder="what should the redraft change?" value={rejectComment} onChange={e=>setRejectComment(e.target.value)} /><button style={btnG} onClick={reject} disabled={busy}>Confirm reject</button><button style={{...btnG,border:'none'}} onClick={()=>{setRejecting(false);setRejectComment('');}} disabled={busy}>cancel</button></>)}
            <button style={{...btnG,fontSize:11}} onClick={generateDraft} disabled={busy}>Regenerate from answers</button>
          </div>
        </div>
      ):(
        <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:8, flexWrap:'wrap' }}>
          <button style={btnP} onClick={generateDraft} disabled={busy}>{busy?'Drafting…':latestApproved?'Draft new version from answers':'Generate draft from answers'}</button>
          {latest?.status==='rejected'&&latest.owner_comments&&<span style={{ fontSize:11.5, color:'var(--ink-soft)' }}>last rejection: &quot;{latest.owner_comments.slice(0,100)}&quot;</span>}
        </div>
      )}
      {latestApproved&&!latestDraft&&(
        <div style={{ marginTop:8 }}>
          <button style={{...btnG,fontSize:11,padding:'2px 8px'}} onClick={()=>setShowApproved(v=>!v)}>{showApproved?'hide approved doc':`view approved doc (v${latestApproved.version})`}</button>
          {showApproved&&<pre style={{ fontSize:11.5, fontFamily:MONO, whiteSpace:'pre-wrap', lineHeight:1.5, border:'1px solid var(--hairline)', borderRadius:6, padding:'8px 10px', marginTop:6, background:'rgba(8,72,56,0.03)', color:'var(--ink)' }}>{latestApproved.content_md}</pre>}
        </div>
      )}
    </div>
  );
}

export default function KnowledgeClient({ propertyId, goals, answers, docs=[], completeness }: { propertyId:number; goals:TenantGoalRow[]; answers:KnowledgeAnswerRow[]; docs?:KnowledgeDocRow[]; completeness:number }) {
  const [editing,setEditing]=useState<GoalDraft|null>(null);
  const [savedMsg,setSavedMsg]=useState('');
  const answerMap=useMemo(()=>{ const m:Record<string,KnowledgeAnswerRow>={}; answers.forEach(a=>{m[a.section+'||'+a.question]=a;}); return m; },[answers]);
  const [draftAnswers,setDraftAnswers]=useState<Record<string,string>>({});
  const [dirty,setDirty]=useState<Record<string,boolean>>({});
  // Which questions are expanded (collapsed by default if answered, expanded if empty)
  const [expandedQ,setExpandedQ]=useState<Set<string>>(()=>{
    const s=new Set<string>(); return s;
  });

  const bigGoals=goals.filter(g=>g.kind==='big_goal');
  const moduleGoalsOf=(id:number)=>goals.filter(g=>g.kind==='module_goal'&&g.parent_goal_id===id);
  const orphanModuleGoals=goals.filter(g=>g.kind==='module_goal'&&g.parent_goal_id==null);

  const missingBySection=JUDGMENT_SECTIONS.map(s=>{
    const answered=s.questions.filter(q=>{ const row=answerMap[s.slug+'||'+q]; const draft=draftAnswers[s.slug+'||'+q]; return (draft??row?.answer??'').trim().length>0; }).length;
    return { slug:s.slug, label:s.label, missing:s.questions.length-answered };
  });

  async function saveAnswers(sectionSlug:string) {
    const section=JUDGMENT_SECTIONS.find(s=>s.slug===sectionSlug); if(!section)return;
    const items=section.questions.map(q=>({key:sectionSlug+'||'+q,question:q})).filter(({key})=>dirty[key]).map(({key,question})=>({section:sectionSlug,question,answer:draftAnswers[key]??''}));
    if(!items.length)return; setSavedMsg('saving…');
    const res=await fetch('/api/settings/knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'answers_save',property_id:propertyId,items})});
    setSavedMsg(res.ok?`saved ${items.length} answer${items.length>1?'s':''}`:'save failed');
    if(res.ok){const cleared={...dirty};items.forEach(it=>{delete cleared[it.section+'||'+it.question];});setDirty(cleared);}
  }

  function toggleQ(key:string){setExpandedQ(prev=>{const next=new Set(prev);if(next.has(key))next.delete(key);else next.add(key);return next;});}
  function answerQuality(val:string):{icon:string;color:string;label:string}{
    if(!val.trim())return{icon:'○',color:'var(--ink-soft)',label:'empty'};
    if(val.trim().length<40)return{icon:'⚠',color:'#B48A3A',label:'needs more detail'};
    return{icon:'✓',color:'var(--primary)',label:'answered'};
  }

  const editingBigGoalId=editing?(editing.parent_goal_id??(editing.kind==='big_goal'?editing.goal_id:null)):null;
  const editingIsNewBigGoal=editing!==null&&editing.kind==='big_goal'&&editing.goal_id===null;

  return (
    <div style={{ color:'var(--ink)' }}>
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, marginBottom:14 }}>
        <span style={{ fontSize:13, fontWeight:650 }}>Knowledge completeness: {completeness}%</span>
        <GapBadge label="Goals" missing={(bigGoals.length?0:1)+(goals.some(g=>g.kind==='module_goal')?0:1)} />
        {missingBySection.map(s=><GapBadge key={s.slug} label={s.label} missing={s.missing} />)}
        <span style={{ fontSize:12, color:'var(--ink-soft)', fontFamily:MONO }}>{savedMsg}</span>
      </div>
      <div style={{ fontSize:12.5, color:'var(--ink-soft)', marginBottom:16 }}>Everything you save here becomes rows the platform treats as canon: agents read it before acting, and the readable knowledge documents are re-rendered from it automatically.</div>

      {/* Client Goals */}
      <div style={{ marginBottom:22 }}>
        <div style={{ fontWeight:650, fontSize:14, color:'var(--primary)', marginBottom:2 }}>Client Goals</div>
        <div style={{ fontSize:12, color:'var(--ink-soft)', marginBottom:8 }}>Your big goals for this hotel, broken into measurable goals per department. Agents steer by these.</div>
        {bigGoals.length===0&&orphanModuleGoals.length===0&&<div style={{ fontSize:12.5, color:'var(--ink-soft)', padding:'6px 0' }}>No goals yet.</div>}
        {bigGoals.map(bg=>{
          const thisCardEditing=editing!==null&&editingBigGoalId===bg.goal_id;
          return (
            <div key={bg.goal_id} style={{ border:'1px solid var(--hairline)', borderRadius:8, padding:'10px 12px', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontWeight:650, fontSize:13, flex:1 }}>{bg.title}</span>
                <button style={{...btnG,fontSize:11,padding:'3px 10px'}} onClick={()=>setEditing(editing?.goal_id===bg.goal_id?null:goalToDraft(bg))}>{editing?.goal_id===bg.goal_id?'Cancel':'Edit'}</button>
                <button style={{...btnG,fontSize:11,padding:'3px 10px'}} onClick={()=>setEditing(emptyGoal('module_goal',bg.goal_id))}>+ Module goal</button>
              </div>
              {bg.description&&<div style={{ fontSize:12, color:'var(--ink-soft)', marginTop:2 }}>{bg.description}</div>}
              {moduleGoalsOf(bg.goal_id).length>0&&(
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, marginTop:8 }}>
                  <thead><tr style={{ borderBottom:'1px solid var(--hairline)' }}>{['Module','Goal','Metric','Baseline','Target','Deadline','Weight','Guardrail',''].map(h=><th key={h} style={{ padding:'3px 6px', textAlign:'left', fontSize:10.5, fontWeight:600, color:'var(--ink-soft)' }}>{h}</th>)}</tr></thead>
                  <tbody>{moduleGoalsOf(bg.goal_id).map(mg=>(
                    <tr key={mg.goal_id} style={{ borderBottom:'1px solid var(--hairline)', background:editing?.goal_id===mg.goal_id?'rgba(8,72,56,0.04)':'transparent' }}>
                      <td style={{ padding:'5px 6px', fontFamily:MONO, fontSize:11.5 }}>{mg.module}</td>
                      <td style={{ padding:'5px 6px' }}>{mg.title}</td>
                      <td style={{ padding:'5px 6px', fontFamily:MONO, fontSize:11.5 }}>{mg.metric??'—'}</td>
                      <td style={{ padding:'5px 6px', fontFamily:MONO, fontSize:11.5 }}>{mg.baseline??'—'}</td>
                      <td style={{ padding:'5px 6px', fontFamily:MONO, fontSize:11.5 }}>{mg.target_value??'—'}</td>
                      <td style={{ padding:'5px 6px', fontFamily:MONO, fontSize:11.5 }}>{mg.deadline?mg.deadline.slice(0,10):'—'}</td>
                      <td style={{ padding:'5px 6px', fontFamily:MONO, fontSize:11.5 }}>{mg.weight??'—'}</td>
                      <td style={{ padding:'5px 6px', fontFamily:MONO, fontSize:11.5 }}>{mg.guardrail_type??'—'}</td>
                      <td style={{ padding:'5px 6px', textAlign:'right' }}><button style={{...btnG,fontSize:11,padding:'2px 8px'}} onClick={()=>setEditing(editing?.goal_id===mg.goal_id?null:goalToDraft(mg))}>{editing?.goal_id===mg.goal_id?'Cancel':'Edit'}</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
              {thisCardEditing&&editing&&<GoalForm draft={editing} propertyId={propertyId} onDone={()=>{setEditing(null);window.location.reload();}} onCancel={()=>setEditing(null)} />}
            </div>
          );
        })}
        {orphanModuleGoals.length>0&&<div style={{ fontSize:12, color:'var(--ink-soft)', marginBottom:6 }}>Unassigned module goals: {orphanModuleGoals.map(g=>g.title).join(' · ')}</div>}
        {editingIsNewBigGoal&&editing?(<GoalForm draft={editing} propertyId={propertyId} onDone={()=>{setEditing(null);window.location.reload();}} onCancel={()=>setEditing(null)} />):(<button style={{...btnG,border:'1px dashed var(--hairline)',color:'var(--primary)'}} onClick={()=>setEditing(emptyGoal('big_goal',null))}>+ Add big goal</button>)}
      </div>

      {/* Judgment sections — collapsible questions */}
      {JUDGMENT_SECTIONS.map(s=>{
        const sectionDocs=docs.filter(d=>d.section===s.slug).sort((a,b)=>b.version-a.version);
        const latestDoc=sectionDocs[0]??null;
        const hasDirtyInSection=s.questions.some(q=>dirty[s.slug+'||'+q]);
        return (
          <div key={s.slug} style={{ marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:2 }}>
              <span style={{ fontWeight:650, fontSize:13.5, color:'var(--primary)' }}>{s.label}</span>
              <GapBadge label="open" missing={missingBySection.find(m=>m.slug===s.slug)?.missing??0} />
              {latestDoc&&<span style={{ fontSize:11, fontFamily:MONO, fontWeight:700, color:STCOL[latestDoc.status]??'var(--ink-soft)', padding:'1px 6px', borderRadius:8, background:'rgba(0,0,0,.05)' }}>doc v{latestDoc.version} · {latestDoc.status}</span>}
            </div>
            <div style={{ fontSize:12, color:'var(--ink-soft)', marginBottom:8 }}>{s.intro}</div>

            {/* Collapsible question rows */}
            <div style={{ border:'1px solid var(--hairline)', borderRadius:6, overflow:'hidden', marginBottom:8 }}>
              {s.questions.map((q,qi)=>{
                const k=s.slug+'||'+q;
                const existing=answerMap[k];
                const val=draftAnswers[k]??existing?.answer??'';
                const { icon, color, label }=answerQuality(val);
                const isExpanded=expandedQ.has(k)||dirty[k];
                const lastEdit=existing?.updated_at?.slice(0,10);
                const by=existing?.answered_by;
                return (
                  <div key={k} style={{ borderBottom:qi<s.questions.length-1?'1px solid var(--hairline)':undefined }}>
                    {/* Collapsed header — always visible */}
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', cursor:'pointer', background:'transparent' }} onClick={()=>toggleQ(k)}>
                      <span style={{ fontSize:14, color, flexShrink:0 }}>{icon}</span>
                      <span style={{ fontSize:12, flex:1, color:'var(--ink)', lineHeight:1.4 }}>{q.length>80?q.slice(0,80)+'…':q}</span>
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                        <span style={{ fontSize:10, color, fontWeight:600 }}>{label}</span>
                        {lastEdit&&<span style={{ fontSize:10, color:'var(--ink-soft)', fontFamily:MONO }}>{lastEdit}{by?` · ${by}`:''}</span>}
                        {val.trim()&&!isExpanded&&<span style={{ fontSize:10, color:'var(--ink-soft)' }}>{val.trim().split(/\s+/).length} words</span>}
                        <span style={{ fontSize:11, color:'var(--ink-soft)' }}>{isExpanded?'▲':'▼'}</span>
                      </div>
                    </div>
                    {/* Expanded textarea */}
                    {isExpanded&&(
                      <div style={{ padding:'4px 12px 12px' }}>
                        {q.length>80&&<div style={{ fontSize:12, color:'var(--ink)', marginBottom:6, lineHeight:1.5 }}>{q}</div>}
                        <textarea value={val} rows={3} onChange={e=>{setDraftAnswers({...draftAnswers,[k]:e.target.value});setDirty({...dirty,[k]:true});}} style={{...inp,fontSize:13,resize:'vertical'}} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
              <button style={btnP} onClick={()=>saveAnswers(s.slug)} disabled={!hasDirtyInSection}>Save {s.label} answers</button>
              {!hasDirtyInSection&&<span style={{ fontSize:11, color:'var(--ink-soft)' }}>— no unsaved changes</span>}
            </div>

            <JudgmentDocPanel propertyId={propertyId} section={s.slug} sectionLabel={s.label} docs={sectionDocs} />
          </div>
        );
      })}
    </div>
  );
}
