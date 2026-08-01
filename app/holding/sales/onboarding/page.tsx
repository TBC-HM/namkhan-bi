// app/holding/sales/onboarding/page.tsx
// Onboarding Engine v2 — interactive dashboard with task actions and property deep links
// Data: v_onboarding_cases + v_onboarding_case_tasks + v_tenant_goals + v_tenant_knowledge_docs
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const FOREST = '#084838';
const AMBER = '#B48A3A'; const RED = '#B03826'; const OK = '#0E7A4B';
const NAVY = '#1A3A5C';

const STATUS_COLOR: Record<string, string> = {
  not_started: INK_M, in_progress: NAVY, blocked: RED,
  ready_for_review: AMBER, accepted: OK, go_live: OK, archived: INK_M,
};
const TASK_STATUS_COLOR: Record<string, string> = {
  done: OK, skipped: INK_M, not_started: AMBER, blocked: RED,
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 10);
}

const TASK_ACTIONS: Record<string, { label: string; href: (pid: number) => string }> = {
  knowledge_intake:        { label: '→ Fill in knowledge', href: (pid) => `/h/${pid}/settings/knowledge` },
  assign_university_paths: { label: '→ University paths', href: (pid) => `/h/${pid}/university` },
  acceptance:              { label: '→ Record acceptance', href: () => '#' },
  connect_pms:             { label: '→ Connect PMS', href: (pid) => `/h/${pid}/settings/data` },
  configure_marketing:     { label: '→ Marketing setup', href: (pid) => `/h/${pid}/settings/property` },
  configure_revenue:       { label: '→ Revenue setup', href: (pid) => `/h/${pid}/settings/property` },
};

export default async function HoldingOnboardingPage() {
  const sb = getSupabaseAdmin();

  const [casesRes, docsRes, goalsRes] = await Promise.all([
    sb.from('v_onboarding_cases').select('*').neq('status', 'archived').order('updated_at', { ascending: false }),
    sb.from('v_tenant_knowledge_docs').select('property_id, status').in('property_id', [260955, 1000001]),
    sb.from('v_tenant_goals').select('property_id, goal_id, kind').in('property_id', [260955, 1000001]),
  ]);

  const cases = (casesRes.data ?? []) as Array<Record<string, unknown>>;

  // Get tasks for each case
  const tasksByCase: Record<string, Array<Record<string, unknown>>> = {};
  for (const c of cases) {
    const caseId = String(c.case_id);
    const { data: tasks } = await sb.from('v_onboarding_case_tasks')
      .select('task_code, title, phase_code, status, required, description')
      .eq('case_id', caseId)
      .order('phase_order').order('sort_order');
    tasksByCase[caseId] = (tasks ?? []) as Array<Record<string, unknown>>;
  }

  const docsByProperty: Record<number, number> = {};
  for (const d of (docsRes.data ?? []) as Array<{ property_id: number; status: string }>) {
    if (d.status === 'approved') docsByProperty[d.property_id] = (docsByProperty[d.property_id] ?? 0) + 1;
  }
  const goalsByProperty: Record<number, number> = {};
  for (const g of (goalsRes.data ?? []) as Array<{ property_id: number; kind: string }>) {
    goalsByProperty[g.property_id] = (goalsByProperty[g.property_id] ?? 0) + 1;
  }

  const totalCases = cases.length;
  const activeCases = cases.filter(c => !['accepted','go_live'].includes(String(c.status))).length;
  const avgPct = totalCases ? Math.round(cases.reduce((s, c) => s + Number(c.completion_pct ?? 0), 0) / totalCases) : 0;

  return (
    <DashboardPage title="Client Onboarding Engine">
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, gridColumn: '1/-1' }}>
        {[
          { label: 'Active cases', value: activeCases, color: NAVY },
          { label: 'Avg completion', value: avgPct + '%', color: avgPct >= 70 ? OK : AMBER },
          { label: 'Blocked', value: cases.filter(c => c.status === 'blocked').length, color: RED },
          { label: 'Accepted', value: cases.filter(c => ['accepted','go_live'].includes(String(c.status))).length, color: OK },
        ].map(k => (
          <div key={k.label} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Property cards */}
      <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
        {cases.map(c => {
          const caseId = String(c.case_id);
          const pid = Number(c.property_id);
          const pct = Number(c.completion_pct ?? 0);
          const isSim = Boolean(c.is_simulation);
          const tasks = tasksByCase[caseId] ?? [];
          const pendingRequired = tasks.filter(t => String(t.status) === 'not_started' && Boolean(t.required));
          const doneTasks = tasks.filter(t => String(t.status) === 'done');
          const statusColor = STATUS_COLOR[String(c.status)] ?? INK_M;
          const knowledgeDocs = docsByProperty[pid] ?? 0;
          const goalsCount = goalsByProperty[pid] ?? 0;

          return (
            <div key={caseId} style={{ background: WHITE, border: `2px solid ${pct === 100 ? OK : AMBER}`, borderRadius: 8, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ background: isSim ? CREAM : FOREST, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: isSim ? INK : WHITE }}>
                    {String(c.client_name)}
                    {isSim && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 10, background: AMBER + '30', color: AMBER, fontWeight: 700 }}>SIMULATION</span>}
                  </div>
                  <div style={{ fontSize: 11, color: isSim ? INK_M : 'rgba(255,255,255,.75)', marginTop: 2 }}>
                    Property {pid} · {String(c.onboarding_model)} · {String(c.template_code)}
                    {c.contract_ref ? ` · ${c.contract_ref}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, background: WHITE, padding: '4px 12px', borderRadius: 20 }}>
                    {String(c.status).replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: isSim ? INK : WHITE }}>{pct}%</span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: CREAM }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? OK : pct >= 50 ? AMBER : RED }} />
              </div>

              <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Left: pending tasks */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 8 }}>
                    Tasks — {doneTasks.length}/{tasks.length} done
                  </div>
                  {isSim && (
                    <div style={{ fontSize: 11, color: AMBER, fontWeight: 600, padding: '8px 12px', background: AMBER + '15', borderRadius: 4, marginBottom: 8 }}>
                      Simulation case — all {tasks.length} tasks marked done as part of dry run.<br/>
                      Real onboarding starts when Mews token arrives. Asking for it IS part of the process.
                    </div>
                  )}
                  {pendingRequired.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 6 }}>
                        Required — pending ({pendingRequired.length})
                      </div>
                      {pendingRequired.map(t => {
                        const action = TASK_ACTIONS[String(t.task_code)];
                        return (
                          <div key={String(t.task_code)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#FEF2F2', borderRadius: 4, marginBottom: 4, gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: INK }}>{String(t.title)}</div>
                              <div style={{ fontSize: 10, color: INK_M }}>{String(t.phase_code)}</div>
                            </div>
                            {action && (
                              <Link href={action.href(pid)} style={{ fontSize: 10, padding: '3px 10px', background: FOREST, color: WHITE, borderRadius: 3, textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
                                {action.label}
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {tasks.filter(t => !Boolean(t.required) && String(t.status) === 'not_started').length > 0 && (
                    <div style={{ fontSize: 10, color: INK_M, marginTop: 4 }}>
                      {tasks.filter(t => !Boolean(t.required) && String(t.status) === 'not_started').length} optional tasks pending
                    </div>
                  )}
                  {pendingRequired.length === 0 && !isSim && (
                    <div style={{ fontSize: 11, color: OK, fontWeight: 600 }}>✓ All required tasks complete</div>
                  )}
                </div>

                {/* Right: knowledge + goals status */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 8 }}>Knowledge & Goals</div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: CREAM, borderRadius: 4 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>Knowledge docs approved</div>
                        <div style={{ fontSize: 10, color: INK_M }}>6 judgment sections · goals wizard</div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: knowledgeDocs > 0 ? OK : AMBER }}>{knowledgeDocs}/6</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: CREAM, borderRadius: 4 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>Goals defined</div>
                        <div style={{ fontSize: 10, color: INK_M }}>1 big goal + module goals needed</div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: goalsCount >= 3 ? OK : AMBER }}>{goalsCount}</div>
                    </div>
                    <Link href={`/h/${pid}/settings/knowledge`}
                      style={{ fontSize: 11, padding: '8px 14px', background: FOREST, color: WHITE, borderRadius: 4, textDecoration: 'none', fontWeight: 600, textAlign: 'center' as const, display: 'block' }}>
                      → Open Knowledge & Goals intake
                    </Link>
                    <Link href={`/h/${pid}/settings/property`}
                      style={{ fontSize: 11, padding: '6px 14px', background: WHITE, color: FOREST, border: `1px solid ${FOREST}`, borderRadius: 4, textDecoration: 'none', fontWeight: 600, textAlign: 'center' as const, display: 'block' }}>
                      → Property settings
                    </Link>
                  </div>
                </div>
              </div>

              {/* Completion footer */}
              <div style={{ borderTop: `1px solid ${HAIR}`, padding: '8px 16px', background: '#FAFAF7', display: 'flex', gap: 16, fontSize: 10, color: INK_M }}>
                <span>Activated: {fmtDate(String(c.activation_at ?? null))}</span>
                <span>Target go-live: {fmtDate(String(c.target_go_live_at ?? null))}</span>
                <span>Updated: {fmtDate(String(c.updated_at ?? null))}</span>
                {c.contract_ref && <span>Contract: {String(c.contract_ref)}</span>}
              </div>
            </div>
          );
        })}
        {cases.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center' as const, color: INK_M, fontSize: 13 }}>
            No onboarding cases — create one via fn_onboarding_create_case when a new client contracts.
          </div>
        )}
      </div>

      {/* AI Skills panel */}
      <Container title="AI Onboarding Skills" subtitle="registered in cap_skills — routes to be built">
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          {[
            { name: 'onboard_ai_knowledge_intake', label: 'AI Knowledge Intake', desc: 'Reads PMS stats + QB GL to pre-fill all 6 judgment section answers as a draft. PBS reviews and saves.' },
            { name: 'onboard_suggest_goals', label: 'AI Goal Suggester', desc: 'Analyzes historical KPIs to suggest realistic module goals with baselines and targets.' },
          ].map(s => (
            <div key={s.name} style={{ padding: '10px 12px', background: CREAM, borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: FOREST }}>{s.name}</div>
                <div style={{ fontSize: 11, color: INK_M }}>{s.desc}</div>
              </div>
              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: AMBER + '25', color: AMBER, fontWeight: 700, whiteSpace: 'nowrap' as const }}>pending build</span>
            </div>
          ))}
        </div>
      </Container>
    </DashboardPage>
  );
}
