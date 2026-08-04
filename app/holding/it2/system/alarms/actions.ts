'use server';
// app/holding/it2/system/alarms/actions.ts
// alarm-system-v1 slice 2 — server actions bridging to public.fn_alarm_*
// (SECURITY DEFINER; PUBLIC+anon revoked per grant-hygiene remediation
// migration alarm_system_v1_grant_hygiene, 2026-08-04).

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const PAGE = '/holding/it2/system/alarms';

export interface ActionResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}

export async function ackAlarm(eventId: number, note: string): Promise<ActionResult> {
  if (!note || note.trim().length < 5) {
    return { ok: false, error: 'Acknowledgement note is required (min 5 chars)' };
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('fn_alarm_ack', {
    p_event_id: eventId,
    p_ack_by: 'owner-ui',
    p_note: note.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true, data };
}

export async function resolveAlarm(eventId: number, note: string): Promise<ActionResult> {
  if (!note || note.trim().length < 5) {
    return { ok: false, error: 'Resolution note is required (min 5 chars)' };
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('fn_alarm_resolve', {
    p_event_id: eventId,
    p_by: 'owner-ui',
    p_note: note.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true, data };
}

export async function setAlarmDef(
  alarmCode: string,
  active: boolean | null,
  cadenceMinutes: number | null,
): Promise<ActionResult> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('fn_alarm_def_set', {
    p_alarm_code: alarmCode,
    p_active: active,
    p_cadence_minutes: cadenceMinutes,
    p_by: 'owner-ui',
  });
  if (error) return { ok: false, error: error.message };
  const json = data as { ok?: boolean; error?: string } | null;
  if (json && json.ok === false) return { ok: false, error: json.error ?? 'update rejected' };
  revalidatePath(PAGE);
  return { ok: true, data };
}
