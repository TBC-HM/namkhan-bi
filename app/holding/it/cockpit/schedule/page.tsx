// app/holding/it/cockpit/schedule/page.tsx
// Scheduler Console v2 (brief ops-scheduler-console-v1, goal 47) — deepens
// the PBS v1 of 2026-07-27. Every scheduled loop across all three schedulers
// (pg_cron + Vercel crons + CCR standing agents) in one console:
// exception-first attention queue, 9 business-group pulse strips with
// per-job drill-down, per-job pause/resume + cadence edit (pg_cron only),
// scoped GLOBAL KILL SWITCH with honest preview + hold-to-confirm + proof
// ledger (intercepted fires), and a change-audit tab.
//
// Server component: fetches everything, classifies, computes late detection;
// all interaction lives in ScheduleClient (toasts per bug #89 law).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import vercelConfig from '@/vercel.json';
import {
  CCR_AGENTS, CCR_READONLY_NOTE, VERCEL_READONLY_NOTE,
  groupOf, tierOf, cronIntervalMinutes,
} from '@/lib/schedule/catalog';
import ScheduleClient, { type UnifiedRow, type AuditRow } from './ScheduleClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type MatrixRow = {
  jobname: string; schedule: string; active: boolean;
  last_status: string | null; last_run: string | null;
  last_secs: number | null; last_message: string | null;
};

export default async function SchedulePage() {
  const sb = getSupabaseAdmin();
  const [matrixRes, masterRes, auditRes, interceptRes] = await Promise.all([
    (sb as any).from('v_schedule_matrix').select('*').order('jobname'),
    (sb as any).rpc('fn_automation_enabled'),
    (sb as any).from('v_schedule_change_log').select('*').order('changed_at', { ascending: false }).limit(200),
    (sb as any).from('cockpit_audit_log').select('id', { count: 'exact', head: true })
      .eq('agent', 'cron-guard').eq('action', 'cron_intercepted'),
  ]);

  const rows = (matrixRes.data ?? []) as MatrixRow[];
  const automationOn = masterRes.data !== false; // null/true → on
  const auditRows = (auditRes.data ?? []) as AuditRow[];
  const interceptCount = interceptRes.count ?? 0;

  const now = Date.now();
  const unified: UnifiedRow[] = [];

  for (const r of rows) {
    // Late detection (dead-man): active job whose last run is older than
    // 2× its cadence interval (min 15 min grace) — or never ran.
    let late = false;
    const interval = cronIntervalMinutes(r.schedule);
    if (r.active && interval != null) {
      const graceMs = Math.max(interval * 2, 15) * 60_000;
      late = r.last_run ? now - Date.parse(r.last_run) > graceMs : false;
    }
    unified.push({
      name: r.jobname,
      system: 'pg_cron',
      schedule: r.schedule,
      active: r.active,
      editable: true,
      group: groupOf(r.jobname),
      tier: tierOf(r.jobname),
      last_status: r.last_status,
      last_run: r.last_run,
      last_secs: r.last_secs,
      last_message: r.last_message,
      late,
      note: null,
    });
  }

  for (const c of (vercelConfig as any).crons ?? []) {
    unified.push({
      name: c.path,
      system: 'vercel',
      schedule: c.schedule,
      active: true, // code-defined; kill path = fn_automation_enabled guard in the route
      editable: false,
      group: groupOf(c.path),
      tier: 'ACT',
      last_status: null, last_run: null, last_secs: null, last_message: null,
      late: false,
      note: VERCEL_READONLY_NOTE,
    });
  }

  for (const a of CCR_AGENTS) {
    unified.push({
      name: a.name,
      system: 'ccr',
      schedule: a.schedule,
      active: !a.paused,
      editable: false,
      group: groupOf(a.name),
      tier: 'ACT',
      last_status: null, last_run: null, last_secs: null,
      last_message: a.what,
      late: false,
      note: CCR_READONLY_NOTE,
    });
  }

  return (
    <ScheduleClient
      rows={unified}
      automationOn={automationOn}
      interceptCount={interceptCount}
      auditRows={auditRows}
    />
  );
}
