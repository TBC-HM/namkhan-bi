// app/onboarding/[token]/page.tsx
// Customer-facing onboarding portal (public, token-based access)
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const FOREST = '#084838';
const AMBER = '#B48A3A'; const OK = '#0E7A4B';

const TASK_STATUS_COLOR: Record<string, string> = {
  done: OK,
  not_started: AMBER,
  blocked: '#B03826',
  skipped: INK_M,
};

export default async function CustomerOnboardingPortal({
  params,
}: {
  params: { token: string };
}) {
  const sb = getSupabaseAdmin();

  const { data: caseData } = await sb
    .rpc('fn_onboarding_get_by_token', { p_portal_token: params.token });

  if (!caseData || caseData.length === 0) {
    notFound();
  }

  const onboardingCase = caseData[0];
  const customerTasks = onboardingCase.customer_tasks || [];
  const completionPct = onboardingCase.completion_pct || 0;
  const targetDate = onboardingCase.target_go_live_at
    ? new Date(onboardingCase.target_go_live_at).toLocaleDateString()
    : '—';

  return (
    <div style={{ minHeight: '100vh', background: CREAM }}>
      <div
        style={{
          background: FOREST,
          color: WHITE,
          padding: '24px 32px',
          borderBottom: `2px solid ${HAIR}`,
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 4 }}>
            The Beyond Circle
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            Welcome to Your Onboarding
          </div>
          <div style={{ fontSize: 16, marginTop: 8, opacity: 0.9 }}>
            {onboardingCase.client_name}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 32px' }}>
        <div
          style={{
            background: WHITE,
            border: `1px solid ${HAIR}`,
            borderRadius: 8,
            padding: '24px 28px',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: INK, marginBottom: 4 }}>
                Overall Progress
              </div>
              <div style={{ fontSize: 14, color: INK_M }}>
                Target go-live: {targetDate}
              </div>
            </div>
            <div
              style={{
                fontSize: 42,
                fontWeight: 700,
                color: completionPct >= 70 ? OK : AMBER,
              }}
            >
              {completionPct}%
            </div>
          </div>
          <div
            style={{
              height: 12,
              background: HAIR,
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${completionPct}%`,
                background: completionPct >= 70 ? OK : AMBER,
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>

        <div
          style={{
            background: WHITE,
            border: `1px solid ${HAIR}`,
            borderRadius: 8,
            padding: '20px 24px',
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: INK, marginBottom: 8 }}>
            📋 What you need to do
          </div>
          <div style={{ fontSize: 14, color: INK_M, lineHeight: 1.6 }}>
            Complete the tasks below to get your property fully set up. Each task links to the
            relevant settings page in your dashboard. If you have questions, contact your
            implementation specialist.
          </div>
        </div>

        {customerTasks.length === 0 ? (
          <div
            style={{
              background: WHITE,
              border: `1px solid ${HAIR}`,
              borderRadius: 8,
              padding: '32px 24px',
              textAlign: 'center' as const,
            }}
          >
            <div style={{ fontSize: 16, color: INK_M }}>
              No customer tasks assigned yet. Your implementation team will reach out soon!
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
            {customerTasks.map((task: any, idx: number) => {
              const statusColor = TASK_STATUS_COLOR[task.status] ?? INK_M;
              const isDone = task.status === 'done';

              return (
                <div
                  key={idx}
                  style={{
                    background: WHITE,
                    border: `2px solid ${isDone ? OK : HAIR}`,
                    borderRadius: 8,
                    padding: '16px 20px',
                    opacity: isDone ? 0.7 : 1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: statusColor + (isDone ? '' : '20'),
                            color: isDone ? WHITE : statusColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                        >
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>
                          {task.title}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: INK_M, marginLeft: 36 }}>
                        {task.description}
                      </div>
                      {task.completed_at && (
                        <div
                          style={{
                            fontSize: 12,
                            color: OK,
                            marginLeft: 36,
                            marginTop: 4,
                          }}
                        >
                          ✓ Completed {new Date(task.completed_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        padding: '6px 12px',
                        borderRadius: 4,
                        background: statusColor + '20',
                        color: statusColor,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase' as const,
                        whiteSpace: 'nowrap' as const,
                      }}
                    >
                      {task.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div
          style={{
            marginTop: 32,
            padding: '16px 20px',
            background: CREAM,
            border: `1px solid ${HAIR}`,
            borderRadius: 8,
            textAlign: 'center' as const,
          }}
        >
          <div style={{ fontSize: 13, color: INK_M }}>
            Questions or need help? Contact your implementation team at{' '}
            <strong style={{ color: INK }}>support@thebeyondcircle.com</strong>
          </div>
        </div>
      </div>
    </div>
  );
}