// app/h/[property_id]/onboarding/page.tsx
// Property-scoped onboarding wizard — step-by-step guide for the client (Namkhan, Donna).
// Multi-session: shows current progress, where to continue, what can wait.
// Entry point to share with client: /h/{property_id}/onboarding
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage } from '@/app/(cockpit)/_design';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const FOREST = '#084838';
const AMBER = '#B48A3A'; const RED = '#B03826'; const OK = '#0E7A4B';

// What to DO for each task — where to go, what it means, how long it takes
const TASK_GUIDE: Record<string, {
  action: string; href?: (pid: number) => string; duration: string; note?: string;
}> = {
  knowledge_intake:        { action: 'Fill in property knowledge & goals', href: (pid) => `/h/${pid}/settings/knowledge`, duration: '2-3 sessions', note: 'Answer 6 sections of questions. Each section generates a knowledge doc agents use. Spread over multiple days — save partial answers.' },
  assign_university_paths: { action: 'Assign learning paths to staff roles', href: (pid) => `/h/${pid}/university`, duration: '30 min', note: 'Choose which role gets which module. One click per role.' },
  acceptance:              { action: 'Confirm onboarding complete', duration: '5 min', note: 'Owner sign-off — the final step. Marks this property as live on the platform.' },
  connect_pms:             { action: 'Connect your PMS (Cloudbeds / Mews)', href: (pid) => `/h/${pid}/settings/data`, duration: '1-2 hours', note: 'Needs PMS API credentials. Can involve your PMS account manager.' },
  configure_frontoffice:   { action: 'Set up front office module', href: (pid) => `/h/${pid}/settings/property`, duration: '1 hour' },
  configure_revenue:       { action: 'Configure revenue settings', href: (pid) => `/h/${pid}/settings/property`, duration: '30 min' },
  configure_marketing:     { action: 'Set up marketing module', href: (pid) => `/h/${pid}/settings/property`, duration: '1 hour' },
  configure_finance:       { action: 'Configure finance module', href: (pid) => `/h/${pid}/settings/property`, duration: '30 min' },
  invite_users:            { action: 'Invite team members', href: (pid) => `/h/${pid}/settings/property`, duration: '15 min' },
  confirm_admin_access:    { action: 'Confirm first login', duration: '5 min' },
  apply_entitlements:      { action: 'Activate your modules', duration: '5 min', note: 'Done by the platform team based on your plan.' },
  provision_tenant:        { action: 'Platform setup', duration: 'Done by platform team' },
  confirm_contract:        { action: 'Confirm signed contract', duration: '1 day', note: 'Sign the platform agreement.' },
  billing_start:           { action: 'Billing activation', duration: 'Handled by platform team' },
  go_live_checklist:       { action: 'Final go-live checks', duration: '30 min', note: 'Platform team verifies everything is ready.' },
  complete_owner_training: { action: 'Complete core training', href: (pid) => `/h/${pid}/university`, duration: '2-3 hours', note: 'Recommended but not blocking — learn at your own pace.' },
};

const PHASE_LABELS: Record<string, string> = {
  contract: '1. Contract', provisioning: '2. Setup', users: '3. Team access',
  entitlements: '4. Modules', data_connect: '5. Data & Knowledge',
  module_config: '6. Configuration', training: '7. Training',
  activation: '8. Activation', go_live: '9. Go-live', acceptance: '10. Acceptance',
};

function statusIcon(status: string): string {
  if (status === 'done') return '✅';
  if (status === 'skipped') return '⤵️';
  if (status === 'blocked') return '🔴';
  return '⬜';
}

export default async function PropertyOnboardingPage({
  params,
}: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const sb = getSupabaseAdmin();

  const [caseRes, propertyRes] = await Promise.all([
    sb.from('v_onboarding_cases').select('*').eq('property_id', propertyId).single(),
    sb.from('v_tenant_goals').select('goal_id').eq('property_id', propertyId).limit(1),
  ]);

  const c = caseRes.data as Record<string, unknown> | null;
  if (!c) {
    return (
      <div style={{ padding: 40, textAlign: 'center' as const, color: INK_M }}>
        No onboarding case found for this property. Contact your platform team to get started.
      </div>
    );
  }

  const { data: tasks } = await sb.from('v_onboarding_case_tasks')
    .select('task_code, title, phase_code, phase_order, status, required, description, sort_order')
    .eq('case_id', String(c.case_id))
    .order('phase_order').order('sort_order');

  const taskList = (tasks ?? []) as Array<Record<string, unknown>>;
  const pct = Number(c.completion_pct ?? 0);
  const isSim = Boolean(c.is_simulation);

  // Group tasks by phase
  const byPhase = new Map<string, Array<Record<string, unknown>>>();
  for (const t of taskList) {
    const ph = String(t.phase_code);
    byPhase.set(ph, [...(byPhase.get(ph) ?? []), t]);
  }

  // Find next pending required task
  const nextTask = taskList.find(t => String(t.status) === 'not_started' && Boolean(t.required));
  const pendingCount = taskList.filter(t => String(t.status) === 'not_started' && Boolean(t.required)).length;
  const doneCount = taskList.filter(t => String(t.status) === 'done').length;

  const propertyName = String(c.client_name ?? 'Your property');

  return (
    <DashboardPage title={`Onboarding · ${propertyName}`}>
      <div style={{ gridColumn: '1/-1' }}>

        {/* Simulation banner */}
        {isSim && (
          <div style={{ padding: '12px 20px', background: AMBER + '20', border: `1px solid ${AMBER}`, borderRadius: 6, marginBottom: 16, fontSize: 13, color: AMBER, fontWeight: 600 }}>
            ℹ️ This is a simulation onboarding — tasks are marked as a dry run. Real onboarding activates when all systems are connected.
          </div>
        )}

        {/* Progress overview */}
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 8, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' as const, gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: INK }}>{propertyName}</div>
              <div style={{ fontSize: 13, color: INK_M, marginTop: 4 }}>
                {doneCount} of {taskList.length} steps complete · {pendingCount} required step{pendingCount !== 1 ? 's' : ''} remaining
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: pct >= 80 ? OK : pct >= 50 ? AMBER : RED }}>{pct}%</div>
          </div>
          <div style={{ height: 8, background: CREAM, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? OK : pct >= 50 ? AMBER : RED, transition: 'width .3s' }} />
          </div>
          {nextTask && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: FOREST + '08', border: `1px solid ${FOREST}44`, borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: FOREST, textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 4 }}>Next step</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 4 }}>{String(nextTask.title)}</div>
              {TASK_GUIDE[String(nextTask.task_code)] && (
                <div style={{ fontSize: 12, color: INK_M, marginBottom: 8 }}>{TASK_GUIDE[String(nextTask.task_code)].note ?? ''}</div>
              )}
              {TASK_GUIDE[String(nextTask.task_code)]?.href && (
                <Link href={TASK_GUIDE[String(nextTask.task_code)].href!(propertyId)}
                  style={{ fontSize: 13, padding: '8px 20px', background: FOREST, color: WHITE, borderRadius: 4, textDecoration: 'none', fontWeight: 700, display: 'inline-block' }}>
                  → Continue onboarding
                </Link>
              )}
            </div>
          )}
          {pendingCount === 0 && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: OK + '15', border: `1px solid ${OK}`, borderRadius: 6, fontSize: 14, fontWeight: 700, color: OK }}>
              ✅ All required steps complete — your platform team will confirm acceptance.
            </div>
          )}
        </div>

        {/* Phase-by-phase walkthrough */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
          {Array.from(byPhase.entries()).map(([phase, phaseTasks]) => {
            const phaseLabel = PHASE_LABELS[phase] ?? phase;
            const allDone = phaseTasks.every(t => ['done','skipped'].includes(String(t.status)));
            const anyBlocked = phaseTasks.some(t => String(t.status) === 'blocked');
            const borderColor = allDone ? OK : anyBlocked ? RED : HAIR;

            return (
              <div key={phase} style={{ background: WHITE, border: `1px solid ${borderColor}`, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: allDone ? OK + '10' : CREAM, borderBottom: `1px solid ${HAIR}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: allDone ? OK : INK }}>{phaseLabel}</span>
                  {allDone && <span style={{ fontSize: 11, color: OK, fontWeight: 700 }}>✅ Complete</span>}
                </div>
                <div style={{ padding: '8px 0' }}>
                  {phaseTasks.map(t => {
                    const code = String(t.task_code);
                    const guide = TASK_GUIDE[code];
                    const isNext = nextTask && String(nextTask.task_code) === code;
                    const status = String(t.status);

                    return (
                      <div key={code} style={{ padding: '8px 16px', borderBottom: `1px solid ${HAIR}88`,
                        background: isNext ? FOREST + '06' : 'transparent' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 16 }}>{statusIcon(status)}</span>
                              <span style={{ fontSize: 13, fontWeight: isNext ? 700 : 500, color: status === 'skipped' ? INK_M : INK }}>
                                {String(t.title)}
                                {!Boolean(t.required) && <span style={{ fontSize: 10, color: INK_M, marginLeft: 6, fontWeight: 400 }}>optional</span>}
                              </span>
                            </div>
                            {guide?.note && status === 'not_started' && (
                              <div style={{ fontSize: 11, color: INK_M, marginTop: 2, marginLeft: 28 }}>{guide.note}</div>
                            )}
                            {guide?.duration && (
                              <div style={{ fontSize: 10, color: INK_M, marginTop: 2, marginLeft: 28 }}>⏱ {guide.duration}</div>
                            )}
                          </div>
                          {guide?.href && status === 'not_started' && (
                            <Link href={guide.href(propertyId)}
                              style={{ fontSize: 11, padding: '4px 12px', background: isNext ? FOREST : WHITE,
                                color: isNext ? WHITE : FOREST, border: `1px solid ${FOREST}`, borderRadius: 3,
                                textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
                              {isNext ? '→ Start' : '→ Go'}
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanation footer */}
        <div style={{ marginTop: 20, padding: '16px 20px', background: CREAM, borderRadius: 6, fontSize: 12, color: INK_M, lineHeight: 1.7 }}>
          <strong style={{ color: INK }}>This is a multi-session process.</strong> You do not need to complete everything in one sitting.<br/>
          Property information, media uploads, and knowledge sections are designed to be filled over multiple working days.<br/>
          Your progress is saved automatically. Come back any time and continue from where you left off.
        </div>
      </div>
    </DashboardPage>
  );
}
