'use client';

// components/settings/KnowledgeClient.tsx
// knowledge-goals-intake-v1: client-side intake for the Knowledge tab.
// - Client Goals: big goals -> module goals (metric/baseline/target/deadline/weight
//   + guardrail type). Rows are canon (governance.tenant_goals via bridge fns).
// - Judgment sections: guided owner-class questions; answers are canon rows
//   (governance.tenant_knowledge_answers). The agent-drafted doc + inline-redline
//   approval cycle (brief §JUDGMENT-DOC FRONTEND CONTRACT) builds on these rows next.
// Design: cockpit tokens only; section-card + gap-badge pattern mirrors
// /settings/property (PBS 2026-07-29: reuse, no second completeness system).

import { useMemo, useState } from 'react';

export type TenantGoalRow = {
  goal_id: number; property_id: number; kind: 'big_goal' | 'module_goal';
  parent_goal_id: number | null; module: string | null; title: string;
  description: string | null; metric: string | null; baseline: number | null;
  target_value: number | null; deadline: string | null; weight: number | null;
  guardrail_type: string | null; status: string; updated_at: string;
};
export type KnowledgeAnswerRow = {
  section: string; question: string; answer: string | null;
  answered_by: string | null; updated_at: string;
};

const MONO = 'JetBrains Mono, ui-monospace, monospace';

export const MODULES = [
  'revenue', 'marketing', 'sales', 'finance', 'operations', 'guest', 'fnb', 'spa', 'hr',
] as const;

export const GUARDRAIL_TYPES = [
  { value: '', label: '— none —' },
  { value: 'floor', label: 'Floor — never go below this number' },
  { value: 'ceiling', label: 'Ceiling — never go above this number' },
  { value: 'approval_required', label: 'Approval required — agents must ask before acting on it' },
  { value: 'watch', label: 'Watch — alert me when it moves, no hard limit' },
];

// Guided judgment questions — owner-class, plain language (rule 594).
export const JUDGMENT_SECTIONS: Array<{
  slug: string; label: string; intro: string; questions: string[];
}> = [
  { slug: 'revenue_philosophy', label: 'Revenue Philosophy',
    intro: 'How you want pricing decisions made when nobody is watching.',
    questions: [
      'When the hotel is nearly empty in low season, do you prefer holding rates (protect the brand) or discounting to fill rooms (protect cash)? Where is the line?',
      'Which guests or channels would you rather turn away than discount for?',
      'How far in advance do you want rates locked vs. left flexible for last-minute moves?',
      'What is the one revenue mistake you never want repeated?',
    ]},
  { slug: 'playbook', label: 'Commercial Playbook',
    intro: 'The moves you actually make through the year.',
    questions: [
      'What are the 3-4 commercial moments of your year (fairs, festivals, seasons) and what do you do around each?',
      'When a big group asks for a quote, what do you always include and what do you never give away?',
      'Which partnerships (DMCs, agents, hotels) matter most and how are they treated differently?',
    ]},
  { slug: 'positioning', label: 'Brand & Competitive Positioning',
    intro: 'Who you are against, and what makes a guest pick you.',
    questions: [
      'Which 3-5 properties do you actually lose guests to, and why do guests pick them?',
      'What do you offer that none of them can copy?',
      'What would you never do even if competitors do it and it works for them?',
    ]},
  { slug: 'guest_profile', label: 'Guest Profile',
    intro: 'Who the right guest is — and who is not.',
    questions: [
      'Describe your ideal guest in one paragraph: who they are, why they come, what they spend on.',
      'Which guest types create the most problems or cost relative to what they pay?',
      'What should every staff member and agent know about how your guests want to be treated?',
    ]},
  { slug: 'escalation_crisis', label: 'Escalation & Crisis',
    intro: 'What reaches you, and what never should.',
    questions: [
      'Which situations must reach you personally, day or night (money amount, guest type, incident kind)?',
      'Who decides what when you are unreachable for 48 hours?',
      'In a public complaint or press situation, what is the standing rule until you weigh in?',
    ]},
  { slug: 'compliance', label: 'Compliance Additions',
    intro: 'Local rules and promises the platform must never break.',
    questions: [
      'Are there local rules, licenses or agreements (beyond standard law) that limit what the hotel may sell, say or do?',
      'Any standing promises to owners, banks or partners that agents must respect (reporting, caps, exclusivities)?',
    ]},
];

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: 12.5, padding: '5px 8px', border: '1px solid var(--hairline)',
  borderRadius: 6, background: 'var(--paper)', color: 'var(--ink)',
};
const labelStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase',
  letterSpacing: 0.4, marginBottom: 2, display: 'block',
};
const btnPrimary: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 650, padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
  border: '1px solid var(--primary)', background: 'var(--primary)', color: 'var(--paper)',
};
const btnGhost: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
  border: '1px solid var(--hairline)', background: 'var(--paper)', color: 'var(--ink)',
};

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

function GapBadge({ label, missing }: { label: string; missing: number }) {
  const done = missing === 0;
  return (
    <span style={{
      fontSize: 11, fontFamily: MONO, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: done ? 'rgba(8,72,56,0.10)' : 'rgba(180,138,58,0.14)',
      color: done ? 'var(--primary)' : '#B48A3A',
    }}>
      {label} {done ? '✓' : missing}
    </span>
  );
}

type GoalDraft = {
  goal_id: number | null; kind: 'big_goal' | 'module_goal'; parent_goal_id: number | null;
  module: string; title: string; description: string; metric: string; baseline: string;
  target_value: string; deadline: string; weight: string; guardrail_type: string;
};

function emptyGoal(kind: 'big_goal' | 'module_goal', parentId: number | null): GoalDraft {
  return { goal_id: null, kind, parent_goal_id: parentId, module: '', title: '', description: '',
    metric: '', baseline: '', target_value: '', deadline: '', weight: '', guardrail_type: '' };
}

function goalToDraft(g: TenantGoalRow): GoalDraft {
  return {
    goal_id: g.goal_id, kind: g.kind, parent_goal_id: g.parent_goal_id,
    module: g.module ?? '', title: g.title, description: g.description ?? '',
    metric: g.metric ?? '', baseline: g.baseline != null ? String(g.baseline) : '',
    target_value: g.target_value != null ? String(g.target_value) : '',
    deadline: g.deadline ? g.deadline.slice(0, 10) : '',
    weight: g.weight != null ? String(g.weight) : '',
    guardrail_type: g.guardrail_type ?? '',
  };
}

function GoalForm({ draft, propertyId, onDone, onCancel }: {
  draft: GoalDraft; propertyId: number; onDone: () => void; onCancel: () => void;
}) {
  const [d, setD] = useState<GoalDraft>(draft);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof GoalDraft, v: string) => setD((p) => ({ ...p, [k]: v }));
  const isModule = d.kind === 'module_goal';

  async function save() {
    if (!d.title.trim()) { setErr('title required'); return; }
    if (isModule && !d.module) { setErr('pick a module'); return; }
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/settings/knowledge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'goal_upsert', property_id: propertyId, goal: d }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(j.error || 'save failed'); setSaving(false); return; }
      onDone();
    } catch (e) { setErr(String(e)); setSaving(false); }
  }

  return (
    <div style={{ border: '1px solid var(--hairline)', borderRadius: 8, padding: '12px 14px',
      margin: '8px 0', background: 'rgba(8,72,56,0.03)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <Field label="Title" span={isModule ? 2 : 4}>
          <input style={inputStyle} value={d.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        {isModule && (
          <>
            <Field label="Module">
              <select style={inputStyle} value={d.module} onChange={(e) => set('module', e.target.value)}>
                <option value="">—</option>
                {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Metric">
              <input style={{ ...inputStyle, fontFamily: MONO }} value={d.metric}
                placeholder="e.g. RGI, GOP margin %" onChange={(e) => set('metric', e.target.value)} />
            </Field>
            <Field label="Baseline (today)">
              <input style={{ ...inputStyle, fontFamily: MONO }} value={d.baseline}
                placeholder="number" onChange={(e) => set('baseline', e.target.value)} />
            </Field>
            <Field label="Target">
              <input style={{ ...inputStyle, fontFamily: MONO }} value={d.target_value}
                placeholder="number" onChange={(e) => set('target_value', e.target.value)} />
            </Field>
            <Field label="Deadline">
              <input type="date" style={inputStyle} value={d.deadline}
                onChange={(e) => set('deadline', e.target.value)} />
            </Field>
            <Field label="Weight (importance 1-10)">
              <input style={{ ...inputStyle, fontFamily: MONO }} value={d.weight}
                placeholder="1-10" onChange={(e) => set('weight', e.target.value)} />
            </Field>
            <Field label="Guardrail" span={2}>
              <select style={inputStyle} value={d.guardrail_type} onChange={(e) => set('guardrail_type', e.target.value)}>
                {GUARDRAIL_TYPES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </Field>
          </>
        )}
        <Field label="Why this goal (context agents should know)" span={4}>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={d.description}
            onChange={(e) => set('description', e.target.value)} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
        <button style={btnPrimary} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save goal'}</button>
        <button style={btnGhost} onClick={onCancel} disabled={saving}>Cancel</button>
        {err && <span style={{ fontSize: 12, color: 'var(--status-red)' }}>{err}</span>}
      </div>
    </div>
  );
}

export default function KnowledgeClient({ propertyId, goals, answers, completeness }: {
  propertyId: number; goals: TenantGoalRow[]; answers: KnowledgeAnswerRow[]; completeness: number;
}) {
  const [editing, setEditing] = useState<GoalDraft | null>(null);
  const [savedMsg, setSavedMsg] = useState('');
  const answerMap = useMemo(() => {
    const m: Record<string, KnowledgeAnswerRow> = {};
    answers.forEach((a) => { m[a.section + '||' + a.question] = a; });
    return m;
  }, [answers]);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const bigGoals = goals.filter((g) => g.kind === 'big_goal');
  const moduleGoalsOf = (id: number) => goals.filter((g) => g.kind === 'module_goal' && g.parent_goal_id === id);
  const orphanModuleGoals = goals.filter((g) => g.kind === 'module_goal' && g.parent_goal_id == null);

  const missingBySection = JUDGMENT_SECTIONS.map((s) => {
    const answered = s.questions.filter((q) => {
      const row = answerMap[s.slug + '||' + q];
      const draft = draftAnswers[s.slug + '||' + q];
      return (draft ?? row?.answer ?? '').trim().length > 0;
    }).length;
    return { slug: s.slug, label: s.label, missing: s.questions.length - answered };
  });

  async function saveAnswers(sectionSlug: string) {
    const section = JUDGMENT_SECTIONS.find((s) => s.slug === sectionSlug);
    if (!section) return;
    const items = section.questions
      .map((q) => ({ key: sectionSlug + '||' + q, question: q }))
      .filter(({ key }) => dirty[key])
      .map(({ key, question }) => ({ section: sectionSlug, question, answer: draftAnswers[key] ?? '' }));
    if (!items.length) return;
    setSavedMsg('saving…');
    const res = await fetch('/api/settings/knowledge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'answers_save', property_id: propertyId, items }),
    });
    setSavedMsg(res.ok ? `saved ${items.length} answer${items.length > 1 ? 's' : ''}` : 'save failed');
    if (res.ok) {
      const cleared = { ...dirty };
      items.forEach((it) => { delete cleared[it.section + '||' + it.question]; });
      setDirty(cleared);
    }
  }

  return (
    <div style={{ color: 'var(--ink)' }}>
      {/* Completeness header — mirrors /settings/property meter pattern */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 650 }}>Knowledge completeness: {completeness}%</span>
        <GapBadge label="Goals" missing={(bigGoals.length ? 0 : 1) + (goals.some((g) => g.kind === 'module_goal') ? 0 : 1)} />
        {missingBySection.map((s) => <GapBadge key={s.slug} label={s.label} missing={s.missing} />)}
        <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontFamily: MONO }}>{savedMsg}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 16 }}>
        Everything you save here becomes rows the platform treats as canon: agents read it before acting,
        and the readable knowledge documents are re-rendered from it automatically. Judgment answers feed
        a drafted document that comes back to you for approval before any agent uses it.
      </div>

      {/* ------------------------------------------------ Client Goals */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontWeight: 650, fontSize: 14, color: 'var(--primary)', marginBottom: 2 }}>Client Goals</div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>
          Your big goals for this hotel, broken into measurable goals per department. Agents steer by these.
        </div>
        {bigGoals.length === 0 && orphanModuleGoals.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', padding: '6px 0' }}>
            No goals yet — start with one big goal (e.g. &quot;Beat the compset on revenue while protecting rate&quot;).
          </div>
        )}
        {bigGoals.map((bg) => (
          <div key={bg.goal_id} style={{ border: '1px solid var(--hairline)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 650, fontSize: 13, flex: 1 }}>{bg.title}</span>
              <button style={{ ...btnGhost, fontSize: 11, padding: '3px 10px' }}
                onClick={() => setEditing(goalToDraft(bg))}>Edit</button>
              <button style={{ ...btnGhost, fontSize: 11, padding: '3px 10px' }}
                onClick={() => setEditing(emptyGoal('module_goal', bg.goal_id))}>+ Module goal</button>
            </div>
            {bg.description && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{bg.description}</div>}
            {moduleGoalsOf(bg.goal_id).length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 8 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                    {['Module', 'Goal', 'Metric', 'Baseline', 'Target', 'Deadline', 'Weight', 'Guardrail', ''].map((h) => (
                      <th key={h} style={{ padding: '3px 6px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-soft)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {moduleGoalsOf(bg.goal_id).map((mg) => (
                    <tr key={mg.goal_id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                      <td style={{ padding: '5px 6px', fontFamily: MONO, fontSize: 11.5 }}>{mg.module}</td>
                      <td style={{ padding: '5px 6px' }}>{mg.title}</td>
                      <td style={{ padding: '5px 6px', fontFamily: MONO, fontSize: 11.5 }}>{mg.metric ?? '—'}</td>
                      <td style={{ padding: '5px 6px', fontFamily: MONO, fontSize: 11.5 }}>{mg.baseline ?? '—'}</td>
                      <td style={{ padding: '5px 6px', fontFamily: MONO, fontSize: 11.5 }}>{mg.target_value ?? '—'}</td>
                      <td style={{ padding: '5px 6px', fontFamily: MONO, fontSize: 11.5 }}>{mg.deadline ? mg.deadline.slice(0, 10) : '—'}</td>
                      <td style={{ padding: '5px 6px', fontFamily: MONO, fontSize: 11.5 }}>{mg.weight ?? '—'}</td>
                      <td style={{ padding: '5px 6px', fontFamily: MONO, fontSize: 11.5 }}>{mg.guardrail_type ?? '—'}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                        <button style={{ ...btnGhost, fontSize: 11, padding: '2px 8px' }}
                          onClick={() => setEditing(goalToDraft(mg))}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
        {orphanModuleGoals.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>
            Unassigned module goals: {orphanModuleGoals.map((g) => g.title).join(' · ')}
          </div>
        )}
        {editing ? (
          <GoalForm
            draft={editing}
            propertyId={propertyId}
            onDone={() => window.location.reload()}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <button style={{ ...btnGhost, border: '1px dashed var(--hairline)', color: 'var(--primary)' }}
            onClick={() => setEditing(emptyGoal('big_goal', null))}>
            + Add big goal
          </button>
        )}
      </div>

      {/* ------------------------------------------------ Judgment sections */}
      {JUDGMENT_SECTIONS.map((s) => (
        <div key={s.slug} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <span style={{ fontWeight: 650, fontSize: 13.5, color: 'var(--primary)' }}>{s.label}</span>
            <GapBadge label="open" missing={missingBySection.find((m) => m.slug === s.slug)?.missing ?? 0} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>{s.intro}</div>
          {s.questions.map((q) => {
            const k = s.slug + '||' + q;
            const existing = answerMap[k];
            const val = draftAnswers[k] ?? existing?.answer ?? '';
            return (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, marginBottom: 3 }}>{q}</div>
                <textarea value={val} rows={2}
                  onChange={(e) => {
                    setDraftAnswers({ ...draftAnswers, [k]: e.target.value });
                    setDirty({ ...dirty, [k]: true });
                  }}
                  style={{ ...inputStyle, fontSize: 13, resize: 'vertical' }} />
                {existing && (existing.updated_at || existing.answered_by) && !dirty[k] && (
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontFamily: MONO, marginTop: 2 }}>
                    last edit: {existing.updated_at?.slice(0, 10)}{existing.answered_by ? ` · by ${existing.answered_by}` : ''}
                  </div>
                )}
              </div>
            );
          })}
          <button style={btnPrimary} onClick={() => saveAnswers(s.slug)}>Save {s.label} answers</button>
        </div>
      ))}
    </div>
  );
}
