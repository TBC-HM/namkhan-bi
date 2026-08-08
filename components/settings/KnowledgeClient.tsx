'use client';

// components/settings/KnowledgeClient.tsx
// UX: collapsible questions with status badge (✓ answered / ⚠ needs work / ○ empty),
// version + last edit inline, GoalForm renders inside each big goal card.
// ISOLATION FIX (finding #60): sections prop replaces JUDGMENT_SECTIONS constant; SECTION_METADATA provides UI intro text.

import { useMemo, useState } from 'react';

export type TenantGoalRow = { goal_id: number; property_id: number; kind: 'big_goal' | 'module_goal'; parent_goal_id: number | null; module: string | null; title: string; description: string | null; metric: string | null; baseline: number | null; target_value: number | null; deadline: string | null; weight: number | null; guardrail_type: string | null; status: string; updated_at: string; };
export type KnowledgeAnswerRow = { section: string; question: string; answer: string | null; answered_by: string | null; updated_at: string; };
export type KnowledgeDocRow = { doc_id: number; section: string; version: number; status: string; content_md: string; owner_comments: string | null; drafted_by: string | null; decided_by: string | null; decided_at: string | null; updated_at: string; };
export type KnowledgeSection = { slug: string; label: string; questions: string[] };

const MONO = 'JetBrains Mono, ui-monospace, monospace';
export const MODULES = ['revenue','marketing','sales','finance','operations','guest','fnb','spa','hr','administration'] as const;
export const GUARDRAIL_TYPES = [{ value:'',label:'— none —' },{ value:'floor',label:'Floor — never go below this number' },{ value:'ceiling',label:'Ceiling — never go above this number' },{ value:'approval_required',label:'Approval required — agents must ask before acting on it' },{ value:'watch',label:'Watch — alert me when it moves, no hard limit' }];

// UI metadata: intro text for each section (not tenant-specific, so not in the database)
const SECTION_METADATA: Record<string, string> = {
  revenue_philosophy: 'How you want pricing decisions made when nobody is watching.',
  playbook: 'The moves you actually make through the year.',
  positioning: 'Who you are against, and what makes a guest pick you.',
  guest_profile: 'Who the right guest is — and who is not.',
  escalation_crisis: 'What reaches you, and what never should.',
  compliance: 'Local rules and promises the platform must never break.',
  activities: 'What guests do here, how it is sold, and what the team needs to know.',
  retreats: 'How retreat programmes are built, sold, and delivered.',
  fnb_ops: 'The Roots restaurant concept, kitchen rules, and F&B operating standards.',
  spa_ops: 'Treatments, booking rules, and what makes the spa a Namkhan signature.',
  transport_ops: 'What the property operates, what it coordinates, and the standing rules.',
  retail_ops: 'What we sell, the sourcing philosophy, and the standing rules.',
  finance_ops: 'Payment terms, currency rules, and what agents must never share.',
  hr_ops: 'How staff should behave, who can make decisions, and non-negotiables.',
};

export default function KnowledgeClient({ propertyId, goals, answers, docs=[], sections, completeness }: { propertyId:number; goals:TenantGoalRow[]; answers:KnowledgeAnswerRow[]; docs?:KnowledgeDocRow[]; sections:KnowledgeSection[]; completeness:number }) {
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

  const missingBySection=sections.map(s=>{
    const answered=s.questions.filter(q=>{ const row=answerMap[s.slug+'||'+q]; const draft=draftAnswers[s.slug+'||'+q]; return (draft??row?.answer??'').trim().length>0; }).length;
    return { slug:s.slug, label:s.label, missing:s.questions.length-answered };
  });

  async function saveAnswers(sectionSlug:string) {
    const section=sections.find(s=>s.slug===sectionSlug); if(!section)return;
    const items=section.questions.map(q=>({key:sectionSlug+'||'+q,question:q})).filter(({key})=>dirty[key]).map(({key,question})=>({section:sectionSlug,question,answer:draftAnswers[key]??''}));
    if(!items.length)return; setSavedMsg('saving…');
    const res=await fetch('/api/settings/knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'answers_save',property_id:propertyId,items})});
    setSavedMsg(res.ok?`saved ${items.length} answer${items.length>1?'s':''}`:'save failed');
    if(res.ok){const cleared={...dirty};items.forEach(it=>{delete cleared[it.section+'||'+it.question];});setDirty(cleared);}
  }

  function toggleQ(key:string){setExpandedQ(prev=>{const next=new Set(prev);if(next.has(key))next.delete(key);else next.add(key);return next;});}
  function answerQuality(val:string):{icon:string;color:string;label:string}{
    const wc=val.trim().split(/\s+/).length; if(wc===0||!val.trim())return{icon:'○',color:'var(--ink-soft)',label:'empty'}; if(wc<15)return{icon:'⚠',color:'var(--amber)',label:'needs work'}; return{icon:'✓',color:'var(--green)',label:'answered'};
  }

  async function saveGoal(goal:GoalDraft) {
    setSavedMsg('saving goal…');
    const res=await fetch('/api/settings/knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'goal_save',property_id:propertyId,goal})});
    if(res.ok){setSavedMsg('goal saved');setEditing(null);}else{setSavedMsg('save failed');}
  }
  function deleteGoal(id:number){if(!confirm('Delete this goal?'))return; fetch('/api/settings/knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'goal_delete',property_id:propertyId,goal_id:id})}).then(r=>{if(r.ok)setSavedMsg('goal deleted');});}

  type GoalDraft={goal_id?:number;kind:'big_goal'|'module_goal';parent_goal_id?:number|null;module?:string|null;title:string;description?:string;metric?:string;baseline?:number|null;target_value?:number|null;deadline?:string;weight?:number|null;guardrail_type?:string;};

  const inp:React.CSSProperties={width:'100%',padding:8,border:'1px solid var(--hairline)',borderRadius:4,fontFamily:'inherit',fontSize:13,color:'var(--ink)'};
  const btnP:React.CSSProperties={padding:'6px 14px',border:'1px solid var(--primary)',borderRadius:5,background:'var(--primary)',color:'#fff',fontWeight:600,fontSize:12,cursor:'pointer',fontFamily:'inherit'};
  const btnS:React.CSSProperties={padding:'6px 12px',border:'1px solid var(--hairline)',borderRadius:5,background:'transparent',color:'var(--ink)',fontSize:12,cursor:'pointer',fontFamily:'inherit'};
  const STCOL:Record<string,string>={pending:'var(--amber)',approved:'var(--green)',rejected:'var(--red)'};

  return (
    <div style={{ padding:0 }}>
      {/* Progress banner */}
      <div style={{ padding:16, background:'var(--bg-soft)', borderRadius:8, marginBottom:24 }}>
        <div style={{ fontSize:13, color:'var(--ink-soft)', marginBottom:6 }}>Knowledge completeness</div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1, height:8, background:'var(--hairline)', borderRadius:8, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${completeness}%`, background:'var(--primary)', borderRadius:8 }}></div>
          </div>
          <span style={{ fontWeight:700, fontSize:15, color:'var(--primary)' }}>{completeness}%</span>
        </div>
        {savedMsg&&<div style={{ fontSize:11, color:'var(--ink-soft)', marginTop:6 }}>{savedMsg}</div>}
      </div>

      {/* Big goals */}
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:14, fontWeight:650, color:'var(--ink)', marginBottom:8 }}>Big Goals</div>
        {bigGoals.length===0&&<div style={{ fontSize:12, color:'var(--ink-soft)', marginBottom:8 }}>No big goals yet. Add one to anchor your revenue strategy and operational standards.</div>}
        {bigGoals.map(g=>(
          <div key={g.goal_id} style={{ border:'1px solid var(--hairline)', borderRadius:6, padding:12, marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:650, fontSize:13, color:'var(--ink)', marginBottom:2 }}>{g.title}</div>
                {g.description&&<div style={{ fontSize:12, color:'var(--ink-soft)', marginBottom:4 }}>{g.description}</div>}
                {g.metric&&<div style={{ fontSize:11, fontFamily:MONO, color:'var(--ink-soft)' }}>{g.metric}: {g.baseline}→{g.target_value} by {g.deadline?.slice(0,10)}</div>}
              </div>
              <button style={btnS} onClick={()=>setEditing({...g})}>Edit</button>
              <button style={{...btnS,color:'var(--red)',borderColor:'var(--red)'}} onClick={()=>deleteGoal(g.goal_id)}>Delete</button>
            </div>
            {moduleGoalsOf(g.goal_id).length>0&&(
              <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--hairline)' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--ink-soft)', marginBottom:4 }}>Module goals:</div>
                {moduleGoalsOf(g.goal_id).map(m=>(
                  <div key={m.goal_id} style={{ fontSize:11, color:'var(--ink-soft)', marginBottom:2 }}>• {m.module}: {m.title}</div>
                ))}
              </div>
            )}
          </div>
        ))}
        {!editing&&<button style={btnP} onClick={()=>setEditing({kind:'big_goal',title:'',description:'',metric:'',baseline:null,target_value:null,deadline:'',weight:null,guardrail_type:''})}>+ Add Big Goal</button>}
        {editing&&editing.kind==='big_goal'&&<GoalForm draft={editing} onSave={saveGoal} onCancel={()=>setEditing(null)} />}
      </div>

      {/* Judgment questions */}
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:14, fontWeight:650, color:'var(--ink)', marginBottom:4 }}>Judgment Questions</div>
        <div style={{ fontSize:12, color:'var(--ink-soft)', marginBottom:16 }}>What every agent and staff member needs to know about how you run this property.</div>
        {sections.map(s=>{
          const sectionDocs=docs.filter(d=>d.section===s.slug).sort((a,b)=>b.version-a.version);
          const latestDoc=sectionDocs[0]??null;
          const hasDirtyInSection=s.questions.some(q=>dirty[s.slug+'||'+q]);
          const intro = SECTION_METADATA[s.slug] ?? '';
          return (
            <div key={s.slug} style={{ marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:2 }}>
                <span style={{ fontWeight:650, fontSize:13.5, color:'var(--primary)' }}>{s.label}</span>
                <GapBadge label="open" missing={missingBySection.find(m=>m.slug===s.slug)?.missing??0} />
                {latestDoc&&<span style={{ fontSize:11, fontFamily:MONO, fontWeight:700, color:STCOL[latestDoc.status]??'var(--ink-soft)', padding:'1px 6px', borderRadius:8, background:'rgba(0,0,0,.05)' }}>doc v{latestDoc.version} · {latestDoc.status}</span>}
              </div>
              <div style={{ fontSize:12, color:'var(--ink-soft)', marginBottom:8 }}>{intro}</div>

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

      {/* Orphan module goals */}
      {orphanModuleGoals.length>0&&(
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:14, fontWeight:650, color:'var(--ink)', marginBottom:8 }}>Module Goals (no parent)</div>
          {orphanModuleGoals.map(g=>(
            <div key={g.goal_id} style={{ border:'1px solid var(--hairline)', borderRadius:6, padding:12, marginBottom:8, fontSize:12 }}>
              <div>{g.module}: {g.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GapBadge({label,missing}:{label:string;missing:number}){
  if(missing===0)return null;
  return <span style={{ fontSize:10, fontWeight:700, color:'var(--amber)', background:'rgba(255,159,10,.15)', padding:'2px 6px', borderRadius:8 }}>{missing} {label}</span>;
}

function GoalForm({draft,onSave,onCancel}:{draft:any;onSave:(g:any)=>void;onCancel:()=>void}){
  const [d,setD]=useState(draft);
  const inp:React.CSSProperties={width:'100%',padding:8,border:'1px solid var(--hairline)',borderRadius:4,fontFamily:'inherit',fontSize:13,color:'var(--ink)'};
  const btnP:React.CSSProperties={padding:'6px 14px',border:'1px solid var(--primary)',borderRadius:5,background:'var(--primary)',color:'#fff',fontWeight:600,fontSize:12,cursor:'pointer',fontFamily:'inherit'};
  const btnS:React.CSSProperties={padding:'6px 12px',border:'1px solid var(--hairline)',borderRadius:5,background:'transparent',color:'var(--ink)',fontSize:12,cursor:'pointer',fontFamily:'inherit'};
  return (
    <div style={{ border:'1px solid var(--hairline)', borderRadius:6, padding:16, marginBottom:12, background:'var(--bg-soft)' }}>
      <div style={{ fontSize:13, fontWeight:650, marginBottom:8 }}>{d.goal_id?'Edit':'New'} {d.kind==='big_goal'?'Big Goal':'Module Goal'}</div>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--ink-soft)', marginBottom:4 }}>Title</label>
      <input type="text" value={d.title} onChange={e=>setD({...d,title:e.target.value})} style={inp} />
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--ink-soft)', marginTop:8, marginBottom:4 }}>Description</label>
      <textarea value={d.description??''} rows={2} onChange={e=>setD({...d,description:e.target.value})} style={inp} />
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--ink-soft)', marginTop:8, marginBottom:4 }}>Metric (e.g. "RevPAR USD")</label>
      <input type="text" value={d.metric??''} onChange={e=>setD({...d,metric:e.target.value})} style={inp} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:8 }}>
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--ink-soft)', marginBottom:4 }}>Baseline</label>
          <input type="number" value={d.baseline??''} onChange={e=>setD({...d,baseline:e.target.value?Number(e.target.value):null})} style={inp} />
        </div>
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--ink-soft)', marginBottom:4 }}>Target</label>
          <input type="number" value={d.target_value??''} onChange={e=>setD({...d,target_value:e.target.value?Number(e.target.value):null})} style={inp} />
        </div>
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--ink-soft)', marginBottom:4 }}>Deadline</label>
          <input type="date" value={d.deadline??''} onChange={e=>setD({...d,deadline:e.target.value})} style={inp} />
        </div>
      </div>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--ink-soft)', marginTop:8, marginBottom:4 }}>Guardrail</label>
      <select value={d.guardrail_type??''} onChange={e=>setD({...d,guardrail_type:e.target.value})} style={inp}>
        {GUARDRAIL_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button style={btnP} onClick={()=>onSave(d)}>Save</button>
        <button style={btnS} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function JudgmentDocPanel({propertyId,section,sectionLabel,docs}:{propertyId:number;section:string;sectionLabel:string;docs:any[]}){
  const [mode,setMode]=useState<'view'|'draft'|'decide'>('view');
  const latestApproved=docs.find(d=>d.status==='approved');
  const latestPending=docs.find(d=>d.status==='pending');
  const btnS:React.CSSProperties={padding:'6px 12px',border:'1px solid var(--hairline)',borderRadius:5,background:'transparent',color:'var(--ink)',fontSize:12,cursor:'pointer',fontFamily:'inherit'};
  if(mode==='view'){
    return (
      <div style={{ marginTop:8 }}>
        {latestApproved&&<div style={{ fontSize:11, color:'var(--green)', marginBottom:4 }}>✓ Approved doc v{latestApproved.version} — {latestApproved.decided_at?.slice(0,10)}</div>}
        {latestPending&&<div style={{ fontSize:11, color:'var(--amber)', marginBottom:4 }}>⚠ Draft v{latestPending.version} pending your decision</div>}
        <button style={btnS} onClick={()=>setMode('draft')}>Draft new {sectionLabel} doc</button>
      </div>
    );
  }
  if(mode==='draft'){
    return <div style={{ fontSize:11, color:'var(--ink-soft)' }}>Draft mode: (placeholder — full form to come)</div>;
  }
  return null;
}
