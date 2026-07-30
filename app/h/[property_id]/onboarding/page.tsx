// app/h/[property_id]/onboarding/page.tsx
// Onboarding-progress page — CLIENT-visible layer 3 of the customer portal
// (brief onboarding-engine-v1): steps done/remaining, next actions, pending
// approvals, target go-live, support contact. Entry point on the client home
// during onboarding; the working portal is the tenant app itself (/h/[pid]/*).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, Container, KpiTile } from '@/app/(cockpit)/_design';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TaskRow = {
  case_task_id: string;
  task_code: string;
  phase_code: string;
  phase_order: number;
  title: string;
  description: string | null;
  owner_role: 'platform' | 'client';
  status: string;
  required: boolean;
  evidence_required: boolean;
  blocked_reason: string | null;
  completed_at: string | null;
  sort_order: number;
};

type CaseRow = {
  case_id: string;
  client_name: string;
  status: string;
  support_contact: string | null;
  target_go_live_at: string | null;
  activation_at: string | null;
  completion_pct: number | null;
  req_done: number | null;
  req_total: number | null;
};

const PHASE_LABEL: Record<string, string> = {
  contract: 'Contract',
  provisioning: 'Tenant setup',
  users: 'Team access',
  entitlements: 'Modules unlocked',
  data_connect: 'Data & settings',
  module_config: 'Module configuration',
  training: 'Training',
  activation: 'First value',
  acceptance: 'Acceptance',
  go_live: 'Go-live',
};

const TASK_MARK: Record<string, string> = {
  done: '✓',
  skipped: '—',
  blocked: '✗',
  in_progress: '›',
  not_started: '○',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 10);
}

export default async function OnboardingProgressPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  const sb = getSupabaseAdmin();

  const { data: caseData } = await sb
    .from('v_onboarding_cases')
    .select('case_id, client_name, status, support_contact, target_go_live_at, activation_at, completion_pct, req_done, req_total')
    .eq('property_id', pid)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(1);
  const kase = (caseData?.[0] ?? null) as CaseRow | null;

  if (!kase) {
    return (
      <DashboardPage title="Onboarding">
        <Container title="Onboarding">
          <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', margin: 0 }}>
            No onboarding case is open for this property. Once your contract is registered,
            your setup progress appears here.
          </p>
        </Container>
      </DashboardPage>
    );
  }

  const { data: taskData } = await sb
    .from('v_onboarding_case_tasks')
    .select('*')
    .eq('case_id', kase.case_id)
    .order('phase_order')
    .order('sort_order');
  const tasks = (taskData ?? []) as TaskRow[];

  const remaining = tasks.filter((t) => t.required && !['done', 'skipped'].includes(t.status));
  const clientActions = remaining.filter((t) => t.owner_role === 'client');
  const blocked = tasks.filter((t) => t.status === 'blocked');

  const phases = Array.from(new Set(tasks.map((t) => t.phase_code)));

  return (
    <DashboardPage title={`Onboarding · ${kase.client_name}`}>
      <Container title="Where you stand" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiTile
            label="Setup complete"
            value={Number(kase.completion_pct ?? 0)}
            unit="%"
            size="sm"
            status={Number(kase.completion_pct ?? 0) >= 100 ? 'green' : 'amber'}
            footnote={`${kase.req_done}/${kase.req_total} required steps`}
          />
          <KpiTile
            label="Waiting on you"
            value={clientActions.length}
            size="sm"
            status={clientActions.length > 0 ? 'amber' : 'green'}
            footnote={clientActions[0]?.title ?? 'nothing pending'}
          />
          <KpiTile
            label="First value reached"
            value={kase.activation_at ? 'yes' : 'not yet'}
            size="sm"
            status={kase.activation_at ? 'green' : 'grey'}
            footnote={kase.activation_at ? fmtDate(kase.activation_at) : 'complete your first use case'}
          />
          <KpiTile
            label="Target go-live"
            value={fmtDate(kase.target_go_live_at)}
            size="sm"
            status="grey"
            footnote={`support: ${kase.support_contact ?? 'pb@thenamkhan.com'}`}
          />
        </div>
      </Container>

      {blocked.length > 0 && (
        <Container title="Blocked" status="red" density="compact">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--color-red-600)' }}>
            {blocked.map((t) => (
              <li key={t.case_task_id}>
                {t.title}
                {t.blocked_reason ? ` — ${t.blocked_reason}` : ''}
              </li>
            ))}
          </ul>
        </Container>
      )}

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Setup steps" subtitle="Steps marked ✓ are done. ○ steps are ahead of you; › is in progress.">
          {phases.map((phase) => {
            const phaseTasks = tasks.filter((t) => t.phase_code === phase);
            const done = phaseTasks.filter((t) => ['done', 'skipped'].includes(t.status)).length;
            return (
              <div key={phase} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 4 }}>
                  {PHASE_LABEL[phase] ?? phase}
                  <span style={{ fontWeight: 400, color: 'var(--color-ink-soft)', marginLeft: 8 }}>
                    {done}/{phaseTasks.length}
                  </span>
                </div>
                {phaseTasks.map((t) => (
                  <div
                    key={t.case_task_id}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      padding: '4px 0 4px 10px',
                      borderLeft: `2px solid ${t.status === 'done' ? 'var(--color-green-700)' : t.status === 'blocked' ? 'var(--color-red-600)' : 'var(--color-hairline)'}`,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          t.status === 'done'
                            ? 'var(--color-green-700)'
                            : t.status === 'blocked'
                              ? 'var(--color-red-600)'
                              : 'var(--color-ink-soft)',
                      }}
                    >
                      {TASK_MARK[t.status] ?? '○'}
                    </span>
                    <span style={{ color: 'var(--color-ink)', fontWeight: t.status === 'done' ? 400 : 600 }}>{t.title}</span>
                    <span style={{ fontSize: 10, color: 'var(--color-ink-soft)' }}>
                      {t.owner_role === 'client' ? 'you' : 'TBC team'}
                      {!t.required ? ' · optional' : ''}
                      {t.completed_at ? ` · ${fmtDate(t.completed_at)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </Container>
      </div>
    </DashboardPage>
  );
}
