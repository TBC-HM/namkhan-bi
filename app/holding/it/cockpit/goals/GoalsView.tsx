'use client';

// app/holding/it/cockpit/goals/GoalsView.tsx
// Goal stack manager: L1 vision -> L2 phases -> L3 capability goals -> L4 machine targets.
// Ratification gates for proposed rows + founder intake questionnaire (governance.goal_intake_answers).
// Design: cockpit tokens (--paper/--ink/--hairline/--primary/--ink-soft), University-style callouts.
// Bug #82 (PBS 2026-07-25): added spec/doc traceability columns:
//   - Goals table: version, last edit, status bulb (from v_goals_with_briefs)
//   - Intake table: updated_at, answered_by per row

import { useMemo, useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';

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

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  proposed:  { bg: 'rgba(180,138,58,0.14)', fg: '#B48A3A' },
  ratified:  { bg: 'rgba(8,72,56,0.10)',    fg: 'var(--primary)' },
  active:    { bg: 'rgba(8,72,56,0.10)',    fg: 'var(--primary)' },
  achieved:  { bg: 'rgba(8,72,56,0.18)',    fg: 'var(--primary)' },
  abandoned: { bg: 'rgba(90,90,90,0.12)',   fg: 'var(--ink-soft)' },
  superseded:{ bg: 'rgba(90,90,90,0.12)',   fg: 'var(--ink-soft)' },
};

function Pill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.active;
  return (
    <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.4,
      padding: '2px 8px', borderRadius: 10, background: s.bg, color: s.fg, textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}

// PBS 2026-07-26 Bug #82: status bulb using design-system tokens only.
// Mapping per owner mandate: green->--status-green, yellow->--status-amber,
// red->--status-red, grey->--status-grey.
const BULB_TOKEN: Record<string, string> = {
  green:  'var(--status-green)',
  yellow: 'var(--status-amber)',
  red:    'var(--status-red)',
  grey:   'var(--status-grey)',
};

function StatusBulb({ color }: { color: 'green' | 'yellow' | 'red' | 'grey' | null }) {
  const token = BULB_TOKEN[color ?? 'grey'] ?? BULB_TOKEN.grey;
  return (
    <span
      title={color ?? 'no brief'}
      style={{
        display: 'inline-block',
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: token,
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
    />
  );
}

const LEVEL_LABEL: Record<number, string> = {
  1: 'L1 · Vision — why this exists (owner-edited, yearly)',
  2: 'L2 · Strategy / phases (quarterly)',
  3: 'L3 · Capability goals — what must exist next (monthly)',
  4: 'L4 · Operational targets — machine-readable numbers loops must hold (continuous)',
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
    'Sell / hold / license intention for the platform (sale demands documentation depth + key-person independence)?',
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
  const [saved, setSaved] = useState<string>('');
  const initialAnswers = useMemo(() => {
    const m: Record<string, string> = {};
    intake.forEach((r) => { m[r.block + '||' + r.question] = r.answer || ''; });
    return m;
  }, [intake]);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  // Build brief lookup keyed by goal_id for O(1) access in render
  const briefByGoalId = useMemo(() => {
    const m: Record<number, BriefRow> = {};
    briefs.forEach((b) => { m[b.goal_id] = b; });
    return m;
  }, [briefs]);

  // Build intake metadata lookup keyed by block+question
  const intakeMeta = useMemo(() => {
    const m: Record<string, { updated_at: string; answered_by: string | null }> = {};
    intake.forEach((r) => { m[r.block + '||' + r.question] = { updated_at: r.updated_at, answered_by: r.answered_by }; });
    return m;
  }, [intake]);

  const byLevel = useMemo(() => {
    const m: Record<number, GoalRow[]> = { 1: [], 2: [], 3: [], 4: [] };
    goals.forEach((g) => { (m[g.level] = m[g.level] || []).push(g); });
    return m;
  }, [goals]);
  const proposedTop = goals.filter((g) => g.status === 'proposed' && g.level <= 2);
  const childrenOf = (id: number) => goals.filter((g) => g.parent_goal_id === id);

  async function ratify(goal_id: number) {
    setBusy(goal_id);
    try {
      await fetch('/api/cockpit/goals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ratify', goal_id }),
      });
      window.location.reload();
    } finally { setBusy(null); }
  }

  async function saveIntake() {
    const items = Object.keys(dirty).filter((k) => dirty[k]).map((k) => {
      const idx = k.indexOf('||');
      return { block: k.slice(0, idx), question: k.slice(idx + 2), answer: answers[k] || '' };
    });
    if (!items.length) return;
    setSaved('saving…');
    const res = await fetch('/api/cockpit/goals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'intake', items }),
    });
    setSaved(res.ok ? 'saved ' + items.length + ' answers' : 'save failed');
    if (res.ok) setDirty({});
  }

  const answeredCount = Object.values(answers).filter((v) => v && v.trim()).length;
  const totalQuestions = INTAKE_BLOCKS.reduce((n, b) => n + b.questions.length, 0);

  return (
    <div style={{ maxWidth: 1080, color: 'var(--ink)' }}>
      <div style={{ margin: '4px 0 16px' }}>
        <div style={{ fontSize: 20, fontWeight: 650 }}>Goals — the platform goal stack</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>
          Canonical store: governance.goals (bridge public.v_goals) · seeded 2026-07-25 (ADR-165) ·
          goals cascade down, evidence flows up · every build brief should carry a goal_id.
        </div>
      </div>

      {proposedTop.length > 0 && (
        <div style={{ border: '1px solid rgba(180,138,58,0.5)', background: 'rgba(180,138,58,0.08)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontWeight: 650, fontSize: 13, marginBottom: 6 }}>Ratification required — top layers are DRAFT until you sign</div>
          {proposedTop.map((g) => (
            <div key={g.goal_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13 }}>
              <Pill status={g.status} />
              <span style={{ flex: 1 }}><b>{g.slug}</b> — {g.title}</span>
              <button onClick={() => ratify(g.goal_id)} disabled={busy === g.goal_id}
                style={{ fontSize: 12, fontWeight: 650, padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
                  border: '1px solid var(--primary)', background: 'var(--primary)', color: 'var(--paper)' }}>
                {busy === g.goal_id ? '…' : 'Ratify'}
              </button>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>
            Ratifying = this becomes the sentence every agent reads and complies with. Amend later only by ADR — cheap to change, impossible to change silently.
          </div>
        </div>
      )}

      {[1, 2, 3, 4].map((lvl) => (
        <Container key={lvl} title={LEVEL_LABEL[lvl]} density="compact">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                <th style={{ padding: '4px 8px 4px 0', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>Slug</th>
                <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)' }}>Goal</th>
                <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>Version</th>
                <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>Last edit</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>Doc</th>
                <th style={{ padding: '4px 0 4px 8px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(byLevel[lvl] || []).map((g) => {
                const brief = briefByGoalId[g.goal_id];
                const lastEdit = brief?.brief_last_edit ? brief.brief_last_edit.slice(0, 10) : null;
                return (
                  <tr key={g.goal_id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                    <td style={{ padding: '7px 8px 7px 0', whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 11.5, color: 'var(--ink-soft)' }}>{g.slug}</td>
                    <td style={{ padding: '7px 8px' }}>
                      <div style={{ fontWeight: lvl <= 2 ? 650 : 500 }}>{g.title}</div>
                      {g.measurable_target && (
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontFamily: MONO }}>{g.measurable_target}</div>
                      )}
                      {lvl === 3 && childrenOf(g.goal_id).length > 0 && (
                        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>targets: {childrenOf(g.goal_id).map((c) => c.slug).join(' · ')}</div>
                      )}
                    </td>
                    <td style={{ padding: '7px 8px', whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 11.5, color: 'var(--ink-soft)' }}>
                      {brief?.brief_version ?? <span style={{ color: 'var(--ink-soft)', opacity: 0.5 }}>—</span>}
                    </td>
                    <td style={{ padding: '7px 8px', whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 11.5, color: 'var(--ink-soft)' }}>
                      {lastEdit ?? <span style={{ opacity: 0.5 }}>—</span>}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                      <StatusBulb color={brief?.status_bulb ?? 'grey'} />
                    </td>
                    <td style={{ padding: '7px 0 7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {g.property_id ? <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--ink-soft)', marginRight: 8 }}>{String(g.property_id)}</span> : null}
                      <Pill status={g.status} />
                    </td>
                  </tr>
                );
              })}
              {(byLevel[lvl] || []).length === 0 && (
                <tr><td colSpan={6} style={{ padding: 8, color: 'var(--ink-soft)', fontSize: 12.5 }}>No rows — this layer is empty. That is a drift hole; add goals.</td></tr>
              )}
            </tbody>
          </table>
        </Container>
      ))}

      <Container title={'Founder intake — the Big Goal questionnaire (' + answeredCount + '/' + totalQuestions + ' answered)'} density="compact">
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 10 }}>
          Everything the system needs from your head that agents cannot infer — especially the ECONOMIC thesis (zero numbers in canon today).
          Answers save to governance.goal_intake_answers and feed the Big Goal doc v1 + new registry rows. Answer in any order; partial saves are fine.
        </div>
        {INTAKE_BLOCKS.map((b) => (
          <div key={b.block} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 650, fontSize: 13.5, color: 'var(--primary)', marginBottom: 2 }}>{b.block}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>{b.intro}</div>
            {b.questions.map((q) => {
              const k = b.block + '||' + q;
              const meta = intakeMeta[k];
              return (
                <div key={k} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, marginBottom: 3 }}>{q}</div>
                  <textarea value={answers[k] || ''} rows={2}
                    onChange={(e) => { setAnswers({ ...answers, [k]: e.target.value }); setDirty({ ...dirty, [k]: true }); }}
                    style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid var(--hairline)',
                      borderRadius: 6, background: 'var(--paper)', color: 'var(--ink)', resize: 'vertical' }} />
                  {meta && (meta.updated_at || meta.answered_by) && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 3, fontSize: 11, color: 'var(--ink-soft)', fontFamily: MONO }}>
                      {meta.updated_at && (
                        <span>last edit: {meta.updated_at.slice(0, 10)}</span>
                      )}
                      {meta.answered_by && (
                        <span>by: {meta.answered_by}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={saveIntake}
            style={{ fontSize: 13, fontWeight: 650, padding: '8px 18px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--primary)', background: 'var(--primary)', color: 'var(--paper)' }}>
            Save answers
          </button>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{saved}</span>
        </div>
      </Container>

      <Container title="How to manage this — the rules" density="compact">
        <ul style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
          <li><b>Goals cascade down, evidence flows up.</b> Every task must trace to a goal (orphan work = kill or justify); every goal must trace to running work (empty goal = declare or delete).</li>
          <li><b>L1/L2 change only by your explicit decision</b>, logged as an ADR. Agents comply with the top sentences at machine speed — a wrong sentence here becomes a wrong platform.</li>
          <li><b>L4 targets are what loops consume.</b> A goal-oriented loop (L3 autonomy) is only allowed a goal that exists here as a measurable row with a stop condition.</li>
          <li><b>Promotions are evidence-gated, never calendar-dated</b> — counters open gates (e.g. L2 status after 25 specs with under 20 percent rejection).</li>
          <li><b>Monthly goal-reconciliation loop</b> (goal: goal-reconciliation-loop) audits this registry against reality so your memory is not the mechanism.</li>
        </ul>
      </Container>
    </div>
  );
}
