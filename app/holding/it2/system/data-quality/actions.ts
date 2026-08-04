'use server';
// app/holding/it2/system/data-quality/actions.ts
// dq-engine-v1 — server actions bridging to public.fn_dq_* (SECURITY DEFINER,
// service_role only per rule 669; dq.* schema is not PostgREST-reachable, L5).

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const PAGE = '/holding/it2/system/data-quality';

export interface ActionResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}

export async function resolveDqException(
  id: number,
  status: 'acknowledged' | 'fixed' | 'waived',
  note: string,
): Promise<ActionResult> {
  if (!note || note.trim().length < 5) return { ok: false, error: 'Resolution note is required (min 5 chars)' };
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('fn_dq_exception_resolve', {
    p_id: id,
    p_status: status,
    p_note: note.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true, data };
}

export async function setDqRule(
  ruleCode: string,
  active: boolean | null,
  threshold: number | null,
): Promise<ActionResult> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('fn_dq_rule_set', {
    p_rule_code: ruleCode,
    p_active: active,
    p_threshold: threshold,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true, data };
}

export async function runDqNow(): Promise<ActionResult> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('fn_dq_run', { p_rule_code: null, p_property_id: null });
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true, data };
}
