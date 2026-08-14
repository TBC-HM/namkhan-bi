// lib/cron/guard.ts
// GLOBAL KILL SWITCH guard for Vercel cron routes (brief ops-scheduler-console-v1, A3).
// Vercel crons cannot be paused at the pg_cron layer — this guard is their
// ONLY kill path. Import and call at the very top of every cron route handler:
//
//   const blocked = await automationGuard('/api/cron/<route>');
//   if (blocked) return blocked;
//
// Behaviour: when public.fn_automation_enabled() is false, the run exits
// early with 200 {skipped:true} and the intercepted fire is logged to
// public.cockpit_audit_log (agent='cron-guard', action='cron_intercepted')
// — that log is the "fire attempts intercepted: N" proof-of-stop counter on
// /holding/it/cockpit/schedule. Fail-open: if the flag check itself errors,
// the cron proceeds (the guard must never be the thing that breaks a loop).
//
// UPDATE 2026-08-14 (cost-gov-findings-slice-kill-switch-coverage item 3):
// Also writes to governance.scheduled_run_skipped for unified skip tracking
// across pg_cron / vercel_cron / github_actions schedulers.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function automationGuard(route: string): Promise<Response | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('fn_automation_enabled');
    if (error || data !== false) return null;
    
    // Log to cockpit_audit_log (legacy path, kept for dashboard compatibility)
    try {
      await (sb as any).from('cockpit_audit_log').insert({
        agent: 'cron-guard',
        action: 'cron_intercepted',
        target: route,
        success: true,
        notes: 'automation kill switch is OFF — scheduled run skipped',
      });
    } catch {
      /* intercept logging is best-effort */
    }
    
    // Log to scheduled_run_skipped (unified skip tracking, item 3)
    try {
      const identifier = route.split('/').pop() || route;
      await (sb as any).rpc('fn_scheduled_run_skip_log', {
        p_scheduler: 'vercel_cron',
        p_identifier: identifier,
        p_reason: 'automation_disabled',
        p_notes: JSON.stringify({ route })
      });
    } catch (e) {
      /* skip logging is best-effort, but log failure for debugging */
      console.error('Failed to log skip record:', e);
    }
    
    return NextResponse.json({ ok: true, skipped: true, reason: 'automation_disabled', route });
  } catch {
    return null;
  }
}
