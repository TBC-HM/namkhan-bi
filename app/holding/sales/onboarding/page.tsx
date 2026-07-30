// app/holding/sales/onboarding/page.tsx
// Onboarding & Activation Engine v1 — holding-side pipeline + implementation
// dashboard (brief onboarding-engine-v1, goal 4). Menu placement per brief:
// HOLDING · Sales substripe → Onboarding.
//
// Data: public.v_onboarding_cases / v_onboarding_case_tasks (bridge views over
// onboarding.*). Lifecycle actions run through public.fn_onboarding_* — this
// page is read-only surveillance; agents/loops drive the checklist.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, Container, KpiTile } from '@/app/(cockpit)/_design';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CaseRow = {
  case_id: string;
  client_name: string;
  property_id: number | null;
  template_code: string;
  onboarding_model: string;
  status: string;
  contract_ref: string | null;
  is_simulation: boolean;
  target_go_live_at: string | null;
  activation_at: string | null;
  completion_pct: number | null;
  req_done: number | null;
  req_total: number | null;
  blocked_count: number | null;
  next_task_title: string | null;
  next_phase_code: string | null;
  updated_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  not_started: 'var(--color-grey-500)',
  in_progress: 'var(--color-blue-500)',
  blocked: 'var(--color-red-600)',
  ready_for_review: 'var(--color-amber-600)',
  accepted: 'var(--color-green-700)',
  go_live: 'var(--color-green-700)',
  archived: 'var(--color-grey-400)',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 10);
}

export default async function HoldingOnboardingPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_onboarding_cases')
    .select('*')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });
  const rows = (data ?? []) as CaseRow[];

  const active = rows.filter((r) => !['accepted', 'go_live'].includes(r.status));
  const blocked = rows.filter((r) => r.status === 'blocked');
  const accepted = rows.filter((r) => ['accepted', 'go_live'].includes(r.status));
  const avgCompletion = rows.length
    ? Math.round(rows.reduce((s, r) => s + Number(r.completion_pct ?? 0), 0) / rows.length)
    : 0;

  return (
    <DashboardPage title="Client Onboarding">
      <Container title="Pipeline health" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <KpiTile label="Cases in onboarding" value={active.length} size="sm" status={active.length > 0 ? 'amber' : 'grey'} />
          <KpiTile label="Avg completion" value={avgCompletion} unit="%" size="sm" status={avgCompletion >= 70 ? 'green' : 'amber'} />
          <KpiTile label="Blocked" value={blocked.length} size="sm" status={blocked.length > 0 ? 'red' : 'green'} />
          <KpiTile label="Accepted / live" value={accepted.length} size="sm" status="green" />
        </div>
      </Container>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title={`Onboarding cases (${rows.length})`}
          subtitle="contract → tenant → users → entitlements → data → modules → training → activation → acceptance → go-live"
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-hairline)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', color: 'var(--color-ink-soft)', fontWeight: 500 }}>Client</th>
                <th style={{ padding: '6px 8px', color: 'var(--color-ink-soft)', fontWeight: 500 }}>Model</th>
                <th style={{ padding: '6px 8px', color: 'var(--color-ink-soft)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '6px 8px', color: 'var(--color-ink-soft)', fontWeight: 500 }}>Done</th>
                <th style={{ padding: '6px 8px', color: 'var(--color-ink-soft)', fontWeight: 500 }}>Next action</th>
                <th style={{ padding: '6px 8px', color: 'var(--color-ink-soft)', fontWeight: 500 }}>Activated</th>
                <th style={{ padding: '6px 8px', color: 'var(--color-ink-soft)', fontWeight: 500 }}>Target go-live</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.case_id} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--color-ink)' }}>
                    {r.property_id ? (
                      <a href={`/h/${r.property_id}/onboarding`} style={{ color: 'var(--color-brand-green)', textDecoration: 'none' }}>
                        {r.client_name}
                      </a>
                    ) : (
                      r.client_name
                    )}
                    {r.is_simulation && (
                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: 'var(--color-grey-100)', color: 'var(--color-ink-soft)', textTransform: 'uppercase' }}>
                        simulation
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', color: 'var(--color-ink-soft)' }}>{r.onboarding_model.replace('_', '-')}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 600, color: STATUS_COLOR[r.status] ?? 'var(--color-ink)' }}>
                    {r.status.replace(/_/g, ' ')}
                    {Number(r.blocked_count ?? 0) > 0 && ` · ${r.blocked_count} blocked`}
                  </td>
                  <td style={{ padding: '6px 8px', color: 'var(--color-ink)' }}>
                    {r.req_done}/{r.req_total} ({Number(r.completion_pct ?? 0)}%)
                  </td>
                  <td style={{ padding: '6px 8px', color: 'var(--color-ink-soft)' }}>
                    {r.next_task_title ?? '—'}
                    {r.next_phase_code ? ` · ${r.next_phase_code}` : ''}
                  </td>
                  <td style={{ padding: '6px 8px', color: r.activation_at ? 'var(--color-green-700)' : 'var(--color-ink-soft)' }}>
                    {r.activation_at ? fmtDate(r.activation_at) : '—'}
                  </td>
                  <td style={{ padding: '6px 8px', color: 'var(--color-ink-soft)' }}>{fmtDate(r.target_go_live_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--color-ink-soft)' }}>
                    No onboarding cases yet — cases are created via fn_onboarding_create_case when a contract lands.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Container>
      </div>
    </DashboardPage>
  );
}
