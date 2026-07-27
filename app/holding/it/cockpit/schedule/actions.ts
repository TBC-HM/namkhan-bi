'use server';
// app/holding/it/cockpit/schedule/actions.ts
// Server actions for the Scheduler Console (brief ops-scheduler-console-v1).
// Every action returns {ok, error?, detail?} so the client island can render
// a success/error toast (bug #89 law: no silent actions).

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const PATH = '/holding/it/cockpit/schedule';

export type ActionResult = { ok: boolean; error?: string; detail?: any };

export async function jobSetAction(input: {
  job: string; active?: boolean; schedule?: string;
}): Promise<ActionResult> {
  try {
    if (!input.job) return { ok: false, error: 'missing job name' };
    if (input.schedule != null) {
      const parts = input.schedule.trim().split(/\s+/);
      if (parts.length !== 5) return { ok: false, error: `"${input.schedule}" is not a 5-field cron expression (minute hour day month weekday)` };
    }
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('fn_cron_job_set', {
      p_jobname: input.job,
      p_active: input.active ?? null,
      p_schedule: input.schedule ?? null,
      p_actor: 'PBS (scheduler console)',
    });
    if (error) return { ok: false, error: error.message };
    if (data && data.ok === false) return { ok: false, error: String(data.error ?? 'unknown error') };
    revalidatePath(PATH);
    return { ok: true, detail: data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function masterSetAction(input: {
  enabled: boolean; scope?: 'agents' | 'everything';
}): Promise<ActionResult> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('fn_automation_set', {
      p_enabled: input.enabled,
      p_actor: 'PBS (scheduler console)',
      p_scope: input.scope ?? 'agents',
    });
    if (error) return { ok: false, error: error.message };
    if (data && data.ok === false) return { ok: false, error: String(data.error ?? 'unknown error') };
    revalidatePath(PATH);
    return { ok: true, detail: data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
