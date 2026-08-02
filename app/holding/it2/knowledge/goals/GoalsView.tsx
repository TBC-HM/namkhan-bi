'use client';
// app/holding/it2/knowledge/goals/GoalsView.tsx
// Rebuilt to use SharedGoalStack — same template as tenant /h/[pid]/settings/knowledge
// Platform goals (L1/L2/L3/L4) now rendered with the same card+table+inline-edit pattern.
// Founder intake questionnaire retained below (holding-specific).

import { useMemo, useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';
import { SharedGoalStack, type GoalGroup, type SharedGoal } from '@/components/goals/SharedGoalStack';

export type GoalRow = {
  goal_id: number; level: number; parent_goal_id: number | null; slug: string; title: string;
  description: string | null; measurable_target: string | null; target_metric: string | null;
  target_operator: string | null; target_value: number | null; property_id: number | null;
  status: string; review_cadence: string | null; ratified_at: string | null; updated_at: string;
};
export type IntakeRow = { block: string; question: string; answer: string | null; updated_at: string; answered_by: string | null };
export type BriefRow = {
  goal_id: number; goal_slug: string; brief_slug: string | null;
  brief_status: string | null; brief_version: string | null;
  brief_last_edit: string | null; status_bulb: 'green' | 'yellow' | 'red' | 'grey' | null;
};

const MONO = 'JetBrains Mono, ui-monospace, monospace';

const LEVEL_CONFIG: Record<number, { label: string; add_label: string }> = {
  1: { label: 'L1 · Vision — why this exists (owner-edited, yearly)', add_label: '+ Add L1 goal' },
  2: { label: 'L2 · Strategy / phases (quarterly)', add_label: '+ Add L2 goal' },
  3: { label: 'L3 · Capability goals — what must exist next (monthly)', add_label: '+ Add L3 goal' },
  4: { label: 'L4 · Operational targets — machine-readable numbers (continuous)', add_label: '+ Add L4 goal' },
};

const INTAKE_BLOCKS: Array<{ block: string; intro: string; questions: string[] }> = [
  { block: 'Technical', intro: 'The architecture-level preferences agents cannot infer.', questions: [
    'What tenant-isolation level do external clients get (shared schema with RLS, schema-per-tenant, project-per-tenant)?',
    'How much model-vendor lock-in is acceptable (Anthropic-only vs abstraction layer)?',
    'What scale ceiling do you accept before re-architecture (number of hotels)?',
    'Build-vs-buy default when a vendor tool covers 80% of a need?',
  ]},
  { block: 'Economic', intro: 'The missing half of the Big Goal — zero numbers exist in canon today.', questions: [
    'Price points and packaging per module (Vector, dashboards, agents) — monthly fee per hotel?',
    'Target MRR at 12 and 24 months?',
    'Maximum cost-to-serve per tenant per month (tokens + infra)?',
    'Minimum gross margin per tenant below which a module is killed?',
    'Your own hourly rate for build/review time (so agent-vs-PBS trade-offs can be computed)?',
  ]},
  { block: 'Commercial', intro: 'Who buys, and what you personally promise them.', questions: [
    'Profile of client #1 (size, region, PMS, sophistication)?',
    'What SLA are you willing to personally guarantee (response time, uptime, data freshness)?',
    'Support languages at launch?',
    'Maximum onboarding time budget per client (your hours)?',
  ]},
  { block: 'Risk & Legal', intro: 'The clauses that decide lawsuits and churn.', questions: [
    'Who owns the data when a client leaves, and in what format do they get it?',
    'Liability cap for a wrong automated action (e.g. bad rate push) — contractual number?',
    'GDPR posture: EU clients from day one? Data residency commitments?',
    'Plan if Anthropic pricing doubles or the API is unavailable for 48h?',
  ]},
  { block: 'Owner', intro: 'The answers that change the architecture itself.', questions: [
    'Hours per week you will realistically give this in 12 months?',
    'Sell / hold / license intention for the platform?',
    'What outcome would make you shut the platform down?',
    'Who inherits the gates if you are unavailable for a month?',
  ]},
  { block: 'Non-goals', intro: 'Strategy is what you say no to.', questions: [
    'What will you refuse to build even if clients beg?',
    'Which client types do you refuse to serve?',
  ]},
];

export function GoalsView({ goals, intake, briefs }: { goals: GoalRow[]; intake: IntakeRow[]; briefs: BriefRow[] }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [saved, setSaved] = useState('');
  const initialAnswers = useMemo(() => {
    const m: Record<string, string> = {};
    intake.forEach(r => { m[r.block + '||' + r.question] = r.answer || ''; });
    return m;
  }, [intake]);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const intakeMeta = useMemo(() => {
    const m: Record<string, { updated_at: string; answered_by: string | null }> = {};
    intake.forEach(r => { m[r.block + '||' + r.question] = { updated_at: r.updated_at, answered_by: r.answered_by }; });
    return m;
  }, [intake]);
  const briefByGoalId = useMemo(() => {
    const m: Record<number, BriefRow> = {};
    briefs.forEach(b => { m[b.goal_id] = b; });
    return m;
  }, [briefs]);

  // Transform GoalRow[] → SharedGoal[] → GoalGroup[]
  const groups: GoalGroup[] = useMemo(() => {
    const byLevel: Record<number, GoalRow[]> = { 1:[], 2:[], 3:[], 4:[] };
    goals.forEach(g => { (byLevel[g.level] = byLevel[g.level] || []).push(g); });
    return [1,2,3,4].map(lvl => {
      const cfg = LEVEL_CONFIG[lvl];
      const sharedGoals: SharedGoal[] = (byLevel[lvl] || []).map(g => {
        const brief = briefByGoalId[g.goal_id];
        return {
          id: g.goal_id,
          kind: `l${lvl}`,
          parent_id: g.parent_goal_id,
          slug: g.slug,
          title: g.title,
          description: g.description,
          status: g.status,
          measurable_target: g.measurable_target,
          review_cadence: g.review_cadence,
          version: brief?.brief_version ?? null,
          last_edit: brief?.brief_last_edit ? brief.brief_last_edit.slice(0,10) : null,
          doc_status: brief?.status_bulb ?? null,
        };
      });
      return { label: cfg.label, level_key: `l${lvl}`, add_label: cfg.add_label, goals: sharedGoals };
    });
  }, [goals, briefByGoalId]);

  const proposedTop = goals.filter(g => g.status === 'proposed' && g.level <= 2);
  const answeredCount = Object.values(answers).filter(v => v && v.trim()).length;
  const totalQ = INTAKE_BLOCKS.reduce((n,b) => n + b.questions.length, 0);

  async function handleGoalSave(draft: Parameters<typeof SharedGoalStack>[0]['onSave'] extends (d: infer D) => unknown ? D : never) {
    const res = await fetch('/api/cockpit/goals', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'upsert', goal: {
        goal_id: draft.id, level: Number((draft.kind.match(/\d+/)||['3'])[0]),
        parent_goal_id: draft.parent_id, slug: draft.slug.trim().toLowerCase(),
        title: draft.title.trim(), description: draft.description.trim()||null,
        measurable_target: draft.measurable_target.trim()||null,
        review_cadence: draft.review_cadence.trim()||null,
        property_id: null,
      }}),
    });
    const j = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(j.error || 'save failed');
  }

  async function ratify(goal_id: number) {
    setBusy(goal_id);
    try { await fetch('/api/cockpit/goals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ratify',goal_id})}); window.location.reload(); }
    finally { setBusy(null); }
  }

  async function saveIntake() {
    const items = Object.keys(dirty).filter(k=>dirty[k]).map(k=>{const i=k.indexOf('||');return{block:k.slice(0,i),question:k.slice(i+2),answer:answers[k]||''};});
    if(!items.length)return; setSaved('saving…');
    const res = await fetch('/api/cockpit/goals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'intake',items})});
    setSaved(res.ok?'saved '+items.length+' answers':'save failed');
    if(res.ok)setDirty({});
  }

  return (
    <div style={{ maxWidth:1080, color:'var(--ink)' }}>
      {/* Header */}
      <div style={{ margin:'4px 0 4px' }}>
        <div style={{ fontSize:12.5, color:'var(--ink-soft)', marginBottom:4 }}>
          Canonical store: governance.goals · seeded 2026-07-25 (ADR-165) · goals cascade down, evidence flows up · every build brief should carry a goal_id.
        </div>
        {/* Completeness bar */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'10px 14px', background:'rgba(8,72,56,0.05)', borderRadius:6, border:'1px solid rgba(8,72,56,0.15)' }}>
          <span style={{ fontSize:13, fontWeight:650 }}>Goal stack: {goals.length} goals · {briefs.filter(b=>b.status_bulb==='green').length} with approved docs</span>
          <span style={{ fontSize:11, color:'var(--ink-soft)' }}>{answeredCount}/{totalQ} founder intake answered</span>
        </div>
      </div>

      {/* Ratification gate */}
      {proposedTop.length>0 && (
        <div style={{ border:'1px solid rgba(180,138,58,0.5)', background:'rgba(180,138,58,0.08)', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ fontWeight:650, fontSize:13, marginBottom:6 }}>Ratification required — top layers are PROPOSED until you sign</div>
          {proposedTop.map(g => (
            <div key={g.goal_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0', fontSize:13 }}>
              <span style={{ flex:1 }}><b>{g.slug}</b> — {g.title}</span>
              <button onClick={()=>ratify(g.goal_id)} disabled={busy===g.goal_id}
                style={{ fontSize:12, fontWeight:650, padding:'5px 14px', borderRadius:6, cursor:'pointer', border:'1px solid var(--primary)', background:'var(--primary)', color:'var(--paper)' }}>
                {busy===g.goal_id?'…':'Ratify'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Goal stack — same template as tenant knowledge page */}
      <SharedGoalStack groups={groups} variant="platform" onSave={handleGoalSave} />

      {/* Founder intake — holding-specific */}
      <Container title={`Founder intake — the Big Goal questionnaire (${answeredCount}/${totalQ} answered)`} density="compact">
        <div style={{ fontSize:12.5, color:'var(--ink-soft)', marginBottom:10 }}>
          Everything the system needs from your head that agents cannot infer — especially the ECONOMIC thesis (zero numbers in canon today). Answers feed the Big Goal doc v1.
        </div>
        {INTAKE_BLOCKS.map(b => (
          <div key={b.block} style={{ marginBottom:18 }}>
            <div style={{ fontWeight:650, fontSize:13.5, color:'var(--primary)', marginBottom:2 }}>{b.block}</div>
            <div style={{ fontSize:12, color:'var(--ink-soft)', marginBottom:8 }}>{b.intro}</div>
            {b.questions.map(q => {
              const k=b.block+'||'+q; const meta=intakeMeta[k];
              return (
                <div key={k} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:12.5, marginBottom:3 }}>{q}</div>
                  <textarea value={answers[k]||''} rows={2}
                    onChange={e=>{setAnswers({...answers,[k]:e.target.value});setDirty({...dirty,[k]:true});}}
                    style={{ width:'100%', fontSize:13, padding:'6px 8px', border:'1px solid var(--hairline)', borderRadius:6, background:'var(--paper)', color:'var(--ink)', resize:'vertical' }} />
                  {meta&&(meta.updated_at||meta.answered_by)&&!dirty[k]&&(
                    <div style={{ display:'flex', gap:12, marginTop:3, fontSize:11, color:'var(--ink-soft)', fontFamily:MONO }}>
                      {meta.updated_at&&<span>last edit: {meta.updated_at.slice(0,10)}</span>}
                      {meta.answered_by&&<span>by: {meta.answered_by}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={saveIntake}
            style={{ fontSize:13, fontWeight:650, padding:'8px 18px', borderRadius:6, cursor:'pointer', border:'1px solid var(--primary)', background:'var(--primary)', color:'var(--paper)' }}>
            Save answers
          </button>
          <span style={{ fontSize:12, color:'var(--ink-soft)' }}>{saved}</span>
        </div>
      </Container>
    </div>
  );
}
