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

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function automationGuard(route: string): Promise<Response | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('fn_automation_enabled');
    if (error || data !== false) return null;
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
    return NextResponse.json({ ok: true, skipped: true, reason: 'automation_disabled', route });
  } catch {
    return null;
  }
}
