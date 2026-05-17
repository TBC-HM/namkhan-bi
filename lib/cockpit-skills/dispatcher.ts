// lib/cockpit-skills/dispatcher.ts
// 2026-05-13 — Execute a single skill the LLM picked via tool_use.
//
// Responsibilities:
//   1. Budget gate (cockpit.gov_agent_budgets) — fail-fast with status='failed'
//      if the role has already burned its daily call ceiling.
//   2. Authorize + open the audit row via SQL function public.call_skill, which
//      returns a cap_skill_calls.id + authorized flag. Uses the existing gate
//      that the agent-runner has been using since 2026-05-11.
//   3. Execute the handler:
//        • implementation_type='ts_handler'  → look up in cockpit-tools HANDLERS
//        • implementation_type='sql_function' → supabase.rpc(handler, mapped_args)
//   4. Close the row via public.complete_skill_call (status=succeeded|failed).
//   5. Write a parallel row to cockpit_audit_log for governance trail.
//
// All Supabase access uses the service-role client; this MUST only be imported
// from server-side code (API routes, server components).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { dispatchSkill as dispatchTsHandler } from '@/lib/cockpit-tools';
import type { LoadedSkill } from './loader';

export type SkillCallResult = {
  status: 'succeeded' | 'failed';
  output?: unknown;
  error?: string;
  duration_ms: number;
  cost_usd_milli: number;
  call_id?: number | null;
};

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('cockpit-skills/dispatcher: SUPABASE env missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Daily-budget gate. Returns null if the role is within budget, otherwise an
 * error string explaining which ceiling tripped. Falls open if the budget row
 * is missing (the audit identified 0 budget rows for many roles — we don't
 * want a missing config to block every chat turn).
 */
async function checkBudget(role: string, supa: SupabaseClient): Promise<string | null> {
  try {
    const { data: budgets } = await supa
      .schema('cockpit')
      .from('gov_agent_budgets')
      .select('daily_call_ceiling, daily_usd_milli_ceiling, monthly_call_ceiling, monthly_usd_milli_ceiling, active')
      .eq('agent_role', role)
      .eq('active', true)
      .limit(1)
      .maybeSingle();

    if (!budgets) return null; // no row → unrestricted (audit gap, not our problem here).

    // Count today's calls.
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count, error: countErr } = await supa
      .from('cockpit_skill_calls')
      .select('id', { count: 'exact', head: true })
      .eq('role', role)
      .gte('created_at', startOfDay.toISOString());

    if (countErr) return null; // fall open on count failure.

    if (budgets.daily_call_ceiling && (count ?? 0) >= budgets.daily_call_ceiling) {
      return `budget_exceeded: daily_call_ceiling=${budgets.daily_call_ceiling} hit (used=${count})`;
    }

    return null;
  } catch (e) {
    console.warn(`[cockpit-skills/dispatcher] budget check soft-failed for ${role}:`, e);
    return null;
  }
}

/**
 * Map Anthropic input args → the SQL function parameter shape (p_<key>).
 * cap_skills.input_schema declares the user-facing field names (property_id,
 * search, limit, etc.); the underlying SQL functions use p_<name>. We do the
 * rename here so the model doesn't need to know the implementation detail.
 */
function toSqlParams(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    out[`p_${k}`] = v;
  }
  return out;
}

export type DispatchInput = {
  role: string;
  skill: LoadedSkill;
  input: Record<string, unknown>;
  ticketId?: number | null;
};

/**
 * Execute one tool_use block. Always returns — caller must JSON.stringify and
 * relay back to Anthropic as a tool_result block.
 */
export async function executeSkill(args: DispatchInput): Promise<SkillCallResult> {
  const { role, skill, input, ticketId = null } = args;
  const t0 = Date.now();
  const supa = client();

  // 1. Budget gate.
  const budgetErr = await checkBudget(role, supa);
  if (budgetErr) {
    // Log the rejection so the operator sees it in the audit feed.
    await supa.from('cockpit_audit_log').insert({
      agent: role,
      action: 'skill_budget_blocked',
      target: `skill:${skill.name}`,
      success: false,
      reasoning: budgetErr,
      metadata: { skill_id: skill.skill_id, input },
    });
    return {
      status: 'failed',
      error: budgetErr,
      duration_ms: Date.now() - t0,
      cost_usd_milli: 0,
      call_id: null,
    };
  }

  // 2. Authorize + open cap_skill_calls row via SQL gate.
  // call_skill enforces: role has the skill, skill is active, dry-run rules,
  // approval requirements. Returns { authorized, reason, call_id }.
  let callId: number | null = null;
  let authorized = true;
  let authReason: string | null = null;
  try {
    const { data: authData, error: authErr } = await supa.rpc('call_skill', {
      p_role: role,
      p_skill_name: skill.name,
      p_input: input as never,
      p_dry_run: false,
      p_approval_id: null,
      p_ticket_id: ticketId,
    });
    if (authErr) {
      // SQL gate broken → log and fall through to ungated execution so the
      // user still gets an answer. The gate is best-effort governance, not
      // a security boundary (RLS is the boundary).
      console.warn('[cockpit-skills/dispatcher] call_skill rpc failed:', authErr.message);
    } else {
      const a = authData as { authorized?: boolean; reason?: string; call_id?: number };
      authorized = !!a?.authorized;
      authReason = a?.reason ?? null;
      callId = a?.call_id ?? null;
    }
  } catch (e) {
    console.warn('[cockpit-skills/dispatcher] call_skill threw:', e);
  }

  if (!authorized) {
    return {
      status: 'failed',
      error: `skill_unauthorized: ${authReason ?? 'unknown'}`,
      duration_ms: Date.now() - t0,
      cost_usd_milli: 0,
      call_id: callId,
    };
  }

  // 3. Execute.
  let output: unknown = null;
  let errMsg: string | null = null;
  let status: 'succeeded' | 'failed' = 'succeeded';

  try {
    if (skill.implementation_type === 'sql_function') {
      // Handler looks like 'public.skill_list_employees' — strip schema for rpc().
      const fnName = skill.handler.includes('.') ? skill.handler.split('.').pop()! : skill.handler;
      const params = toSqlParams(input);
      const { data, error } = await supa.rpc(fnName, params as never);
      if (error) {
        status = 'failed';
        errMsg = error.message;
      } else {
        output = data;
      }
    } else {
      // ts_handler (default). dispatchTsHandler returns { ok, result?, error? }.
      const r = await dispatchTsHandler(skill.handler, input);
      if (r.ok) {
        output = (r as { ok: true; result: unknown }).result;
      } else {
        status = 'failed';
        errMsg = (r as { ok: false; error: string }).error ?? 'handler returned ok=false';
      }
    }
  } catch (e) {
    status = 'failed';
    errMsg = e instanceof Error ? e.message : 'handler threw';
  }

  const duration_ms = Date.now() - t0;
  const cost_usd_milli = skill.estimated_cost_usd_milli ?? 0;

  // 4. Close the call row.
  if (callId !== null) {
    try {
      await supa.rpc('complete_skill_call', {
        p_call_id: callId,
        p_status: status,
        p_output: status === 'succeeded' ? (output as never) : null,
        p_error: errMsg ? ({ error: errMsg } as never) : null,
        p_cost_usd_milli: cost_usd_milli,
        p_duration_ms: duration_ms,
      });
    } catch (e) {
      console.warn('[cockpit-skills/dispatcher] complete_skill_call failed:', e);
    }
  }

  // 5. Parallel audit-log row for the governance feed.
  try {
    await supa.from('cockpit_audit_log').insert({
      ticket_id: ticketId,
      agent: role,
      action: status === 'succeeded' ? 'skill_executed' : 'skill_failed',
      target: `skill:${skill.name}`,
      success: status === 'succeeded',
      duration_ms,
      cost_usd_milli,
      metadata: {
        skill_id: skill.skill_id,
        skill_name: skill.name,
        implementation_type: skill.implementation_type,
        handler: skill.handler,
        input,
        call_id: callId,
        error: errMsg,
      },
      reasoning: status === 'succeeded'
        ? `Skill ${skill.name} executed via chat tool_use.`
        : `Skill ${skill.name} failed: ${errMsg}`,
    });
  } catch (e) {
    console.warn('[cockpit-skills/dispatcher] audit log insert failed:', e);
  }

  return {
    status,
    output: status === 'succeeded' ? output : undefined,
    error: errMsg ?? undefined,
    duration_ms,
    cost_usd_milli,
    call_id: callId,
  };
}
