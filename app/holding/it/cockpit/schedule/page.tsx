// app/holding/it/cockpit/schedule/page.tsx
// PBS 2026-07-27 — the schedule matrix: every scheduled loop in one table
// (pg_cron jobs + the two CCR standing agents), last outcome, per-job kill
// switch and the master kill switch. The console the ops-scheduler brief
// will deepen; this is the live v1 so PBS can SEE the machine's heartbeat.

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '../_components/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type MatrixRow = {
  jobname: string; schedule: string; active: boolean;
  last_status: string | null; last_run: string | null;
  last_secs: number | null; last_message: string | null;
};

// The two standing agents run on Claude Code Remote (not pg_cron) — shown
// statically so the matrix is COMPLETE. Their kill switch is the master flag.
const CCR_AGENTS = [
  { jobname: 'module-builder (CCR standing agent)', schedule: '15 * * * *', what: 'builds ONE ready brief per tick' },
  { jobname: 'spec-pipeline-runner (CCR standing agent)', schedule: '45 * * * *', what: 'research, intake, verify stages' },
];

async function toggleJob(formData: FormData) {
  'use server';
  const job = String(formData.get('job') ?? '');
  const enable = String(formData.get('enable') ?? '') === 'true';
  if (!job) return;
  const sb = getSupabaseAdmin();
  await (sb as any).rpc('fn_cron_job_set', { p_jobname: job, p_active: enable, p_actor: 'PBS' });
  revalidatePath('/holding/it/cockpit/schedule');
}

async function toggleMaster(formData: FormData) {
  'use server';
  const enable = String(formData.get('enable') ?? '') === 'true';
  const sb = getSupabaseAdmin();
  await (sb as any).rpc('fn_automation_set', { p_enabled: enable, p_actor: 'PBS' });
  revalidatePath('/holding/it/cockpit/schedule');
}

function cronPlain(c: string): string {
  const m = c.trim().split(/\s+/);
  if (m.length !== 5) return c;
  const [min, hour] = m;
  if (hour === '*' && min !== '*') return `hourly at :${min.padStart(2, '0')}`;
  if (hour !== '*' && !hour.includes('*') && !hour.includes('/') && min !== '*') return `daily ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`;
  if (hour.startsWith('*/')) return `every ${hour.slice(2)}h at :${min.padStart(2, '0')}`;
  return c;
}

export default async function SchedulePage() {
  const sb = getSupabaseAdmin();
  const [{ data: matrix }, { data: master }] = await Promise.all([
    (sb as any).from('v_schedule_matrix').select('*').order('jobname'),
    (sb as any).rpc('fn_automation_enabled'),
  ]);
  const rows = (matrix ?? []) as MatrixRow[];
  const automationOn = master !== false; // null/true → on

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, color: TOKENS.ink }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Schedule Matrix</div>
          <p style={{ fontSize: 12, color: TOKENS.text2, margin: '4px 0 0' }}>
            Every scheduled loop, its cadence, last outcome, and its own switch. All times UTC (Laos = UTC+7).
          </p>
        </div>
        <form action={toggleMaster} style={{ margin: 0 }}>
          <input type="hidden" name="enable" value={String(!automationOn)} />
          <button type="submit" style={{
            fontSize: 12, fontWeight: 700, padding: '10px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: automationOn ? 'var(--status-red)' : 'var(--status-green)', color: '#fff',
          }}>
            {automationOn ? '⏸ KILL SWITCH — stop ALL automation' : '▶ Automation is OFF — turn everything back on'}
          </button>
        </form>
      </div>

      {!automationOn && (
        <div style={{ background: '#FDECE4', border: '1px solid var(--status-red)', borderRadius: 8, padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'var(--status-red)', marginBottom: 12 }}>
          Master kill switch is ON — no loop writes anything until you re-enable.
        </div>
      )}

      <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${TOKENS.border}`, background: TOKENS.bg }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500, width: '30%' }}>Loop</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Cadence</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Last run</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Outcome</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: TOKENS.text2, fontWeight: 500 }}>Switch</th>
            </tr>
          </thead>
          <tbody>
            {CCR_AGENTS.map((a) => (
              <tr key={a.jobname} style={{ borderBottom: `1px solid ${TOKENS.border}`, background: '#FBF9F2' }}>
                <td style={{ padding: '9px 12px', fontWeight: 600 }}>{a.jobname}<div style={{ fontSize: 10, color: TOKENS.text3 }}>{a.what}</div></td>
                <td style={{ padding: '9px 10px', fontFamily: MONO, fontSize: 11 }}>{cronPlain(a.schedule)}</td>
                <td style={{ padding: '9px 10px', color: TOKENS.text2, fontSize: 11 }} colSpan={2}>runs on Claude Code Remote — activity visible per brief (watch panel)</td>
                <td style={{ padding: '9px 10px', fontSize: 11, color: TOKENS.text2 }}>{automationOn ? 'master switch' : 'OFF (master)'}</td>
              </tr>
            ))}
            {rows.map((r) => (
              <tr key={r.jobname} style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                <td style={{ padding: '9px 12px', fontFamily: MONO, fontSize: 11.5, fontWeight: 600 }}>{r.jobname}</td>
                <td style={{ padding: '9px 10px', fontFamily: MONO, fontSize: 11 }}>{cronPlain(r.schedule)}</td>
                <td style={{ padding: '9px 10px', fontFamily: MONO, fontSize: 11, color: TOKENS.text2, whiteSpace: 'nowrap' }}>
                  {r.last_run ? r.last_run.slice(0, 16).replace('T', ' ') : '—'}
                  {r.last_secs != null && <span style={{ color: TOKENS.text3 }}> · {Math.round(r.last_secs)}s</span>}
                </td>
                <td style={{ padding: '9px 10px' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                    background: r.last_status === 'succeeded' ? '#EAF1EE' : r.last_status ? '#FDECE4' : TOKENS.bg,
                    color: r.last_status === 'succeeded' ? 'var(--status-green)' : r.last_status ? 'var(--status-red)' : TOKENS.text2,
                  }}>{r.last_status ?? 'never ran'}</span>
                  {r.last_status && r.last_status !== 'succeeded' && r.last_message && (
                    <div style={{ fontSize: 10, color: 'var(--status-red)', marginTop: 3, maxWidth: 320 }}>{r.last_message.slice(0, 160)}</div>
                  )}
                </td>
                <td style={{ padding: '9px 10px' }}>
                  <form action={toggleJob} style={{ margin: 0 }}>
                    <input type="hidden" name="job" value={r.jobname} />
                    <input type="hidden" name="enable" value={String(!r.active)} />
                    <button type="submit" style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                      border: `1px solid ${r.active ? 'var(--status-green)' : TOKENS.border}`,
                      background: r.active ? '#EAF1EE' : TOKENS.bg,
                      color: r.active ? 'var(--status-green)' : TOKENS.text2,
                    }}>{r.active ? 'ON — click to pause' : 'OFF — click to enable'}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
