// app/university/paths/supervisor/page.tsx
// TBC University · supervisor dashboard (design spec item 5: training becomes
// enforceable). One row per person × path with progress, quiz state, and last
// activity — from public.v_university_path_progress_summary (ADR-186).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import Breadcrumbs from '../../_components/Breadcrumbs';
import { INK, INK_SOFT, HAIR, GREEN, GOLD, RED, WARM, SANS } from '../../_lib/theme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SummaryRow = {
  path_slug: string; path_title: string; user_email: string;
  items_done: number; items_total: number; last_activity: string | null;
  quizzes_passed: boolean;
};

export default async function SupervisorPage() {
  let rows: SummaryRow[] = [];
  let loadError: string | null = null;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('v_university_path_progress_summary')
      .select('*')
      .order('path_slug')
      .order('user_email');
    if (error) loadError = error.message;
    rows = (data as SummaryRow[] | null) ?? [];
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'load failed';
  }

  const th = { padding: '6px 10px', fontWeight: 600, fontSize: 12, color: INK_SOFT, textAlign: 'left' as const };
  const td = { padding: '7px 10px', fontSize: 13, color: INK };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '20px 24px 60px', fontFamily: SANS }}>
      <Breadcrumbs items={[
        { label: 'TBC University', href: '/university' },
        { label: 'Learning paths', href: '/university/paths' },
        { label: 'Team progress' },
      ]} />
      <header style={{ margin: '10px 0 16px' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: INK }}>Team training progress</h1>
        <p style={{ margin: '5px 0 0', fontSize: 14, lineHeight: 1.6, color: INK_SOFT }}>
          Who has started, finished, and passed each learning path. A person appears once they complete their first step.
        </p>
      </header>

      {loadError && <div style={{ fontSize: 13, color: RED, marginBottom: 12 }}>Could not load progress: {loadError}</div>}

      {rows.length === 0 && !loadError ? (
        <div style={{ border: `1.5px dashed ${HAIR}`, borderRadius: 8, background: WARM, padding: '30px 24px', textAlign: 'center', fontSize: 14, color: INK_SOFT }}>
          No one has started a learning path yet. Share <strong>/university/paths</strong> with the team.
        </div>
      ) : rows.length > 0 && (
        <div style={{ background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: WARM }}>
                <th style={th}>Person</th>
                <th style={th}>Path</th>
                <th style={th}>Progress</th>
                <th style={th}>Quiz</th>
                <th style={th}>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pct = r.items_total > 0 ? Math.round((r.items_done / r.items_total) * 100) : 0;
                const complete = r.items_done >= r.items_total && r.quizzes_passed;
                return (
                  <tr key={i} style={{ borderTop: `1px solid ${HAIR}` }}>
                    <td style={td}>{r.user_email}</td>
                    <td style={td}>{r.path_title}</td>
                    <td style={{ ...td, minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: WARM, overflow: 'hidden', border: `1px solid ${HAIR}` }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: complete ? GREEN : GOLD }} />
                        </div>
                        <span style={{ fontSize: 12, color: INK_SOFT, whiteSpace: 'nowrap' }}>{r.items_done}/{r.items_total}</span>
                      </div>
                    </td>
                    <td style={td}>
                      {r.quizzes_passed
                        ? <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>✓ passed</span>
                        : <span style={{ fontSize: 12, fontWeight: 600, color: GOLD }}>pending</span>}
                    </td>
                    <td style={{ ...td, fontSize: 12.5, color: INK_SOFT }}>
                      {r.last_activity ? new Date(r.last_activity).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
