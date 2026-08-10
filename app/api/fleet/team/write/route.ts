// app/api/fleet/team/write/route.ts
// Brief agent-team-slice-write-ctas: single audited write path for the
// Agent Team pillar 1-3 CTAs. The browser NEVER writes tables directly —
// every action dispatches to an existing public.fn_* SECURITY DEFINER
// wrapper via the service-role client (claude_md §0.5 / §0.6 discipline).
// One route with an explicit action whitelist instead of eight routes:
// one auth surface, one error shape, one audit funnel.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS_VOCAB = ['active', 'disabled', 'dormant'] as const;

type Dispatch = { fn: string; args: Record<string, unknown> } | { error: string };

function buildDispatch(action: string, p: Record<string, any>): Dispatch {
  switch (action) {
    case 'set_prompt': {
      if (!p.role || typeof p.system_prompt !== 'string' || !p.system_prompt.trim())
        return { error: 'role and non-empty system_prompt required' };
      return {
        fn: 'fn_agent_set_prompt',
        args: { p_role: p.role, p_system_prompt: p.system_prompt, p_note: p.note ?? null },
      };
    }
    case 'set_status': {
      if (!p.role || !STATUS_VOCAB.includes(p.status))
        return { error: `role required and status must be one of ${STATUS_VOCAB.join('/')}` };
      return { fn: 'fn_agent_set_status', args: { p_role: p.role, p_status: p.status } };
    }
    case 'grant_skill': {
      if (!p.role || !Number.isInteger(p.skill_id)) return { error: 'role and integer skill_id required' };
      return { fn: 'fn_agent_grant_skill', args: { p_role: p.role, p_skill_id: p.skill_id } };
    }
    case 'revoke_skill': {
      if (!p.role || !Number.isInteger(p.skill_id)) return { error: 'role and integer skill_id required' };
      return { fn: 'fn_agent_revoke_skill', args: { p_role: p.role, p_skill_id: p.skill_id } };
    }
    case 'propose_skill': {
      if (!p.role || !p.skill_name?.trim() || !p.justification?.trim())
        return { error: 'role, skill_name and justification required' };
      return {
        fn: 'fn_agent_propose_skill',
        args: {
          p_role: p.role,
          p_skill_name: p.skill_name,
          p_justification: p.justification,
          p_description: p.description ?? null,
          p_http_method: p.http_method ?? null,
          p_endpoint: p.endpoint ?? null,
        },
      };
    }
    case 'add_memory': {
      if (!p.role || !p.content?.trim()) return { error: 'role and content required' };
      const imp = Number.isInteger(p.importance) ? p.importance : 5;
      if (imp < 1 || imp > 10) return { error: 'importance must be 1-10' };
      return {
        fn: 'fn_agent_add_memory',
        args: {
          p_role: p.role,
          p_content: p.content,
          p_importance: imp,
          p_topics: Array.isArray(p.topics) ? p.topics.filter((t: any) => typeof t === 'string') : [],
        },
      };
    }
    case 'archive_memory': {
      if (!p.memory_id || !p.reason?.trim()) return { error: 'memory_id and reason required' };
      return {
        fn: 'fn_agent_archive_memory',
        args: { p_memory_id: p.memory_id, p_reason: p.reason, p_superseded_by: p.superseded_by ?? null },
      };
    }
    case 'bulk_grant_skills': {
      if (!Array.isArray(p.roles) || !p.roles.length || !Array.isArray(p.skill_ids) || !p.skill_ids.length)
        return { error: 'non-empty roles[] and skill_ids[] required' };
      if (p.roles.length > 200 || p.skill_ids.length > 50) return { error: 'bulk grant too large' };
      return {
        fn: 'fn_agent_bulk_grant_skills',
        args: { p_roles: p.roles, p_skill_ids: p.skill_ids.filter((n: any) => Number.isInteger(n)) },
      };
    }
    case 'add_trigger': {
      const TYPES = ['cron', 'event', 'webhook', 'manual'];
      if (!p.role || !TYPES.includes(p.trigger_type))
        return { error: `role required and trigger_type must be one of ${TYPES.join('/')}` };
      if (p.trigger_type === 'cron' && !p.cron_expr?.trim())
        return { error: 'cron_expr required for a cron trigger' };
      if (p.trigger_type === 'event' && !p.event_kind?.trim())
        return { error: 'event_kind required for an event trigger' };
      if (p.trigger_type === 'webhook' && !p.webhook_path?.trim())
        return { error: 'webhook_path required for a webhook trigger' };
      return {
        fn: 'fn_agent_add_trigger',
        args: {
          p_role: p.role,
          p_trigger_type: p.trigger_type,
          p_cron_expr: p.cron_expr?.trim() || null,
          p_event_kind: p.event_kind?.trim() || null,
          p_webhook_path: p.webhook_path?.trim() || null,
          p_notes: p.notes?.trim() || null,
        },
      };
    }
    case 'set_trigger_active': {
      if (typeof p.trigger_id !== 'string' || !p.trigger_id.trim() || typeof p.active !== 'boolean')
        return { error: 'trigger_id (uuid) and boolean active required' };
      return { fn: 'fn_agent_set_trigger_active', args: { p_trigger_id: p.trigger_id, p_active: p.active } };
    }
    case 'set_budget': {
      const daily = Number(p.daily_cap_usd);
      const monthly = Number(p.monthly_cap_usd);
      if (!p.role || !Number.isFinite(daily) || !Number.isFinite(monthly) || daily < 0 || monthly < 0)
        return { error: 'role, non-negative daily_cap_usd and monthly_cap_usd required' };
      return {
        fn: 'fn_agent_set_budget',
        args: { p_role: p.role, p_daily: daily, p_monthly: monthly, p_enforced: p.enforced !== false },
      };
    }
    default:
      return { error: `unknown action '${action}'` };
  }
}

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const action = typeof body?.action === 'string' ? body.action : '';
  const dispatch = buildDispatch(action, body ?? {});
  if ('error' in dispatch) {
    return NextResponse.json({ ok: false, error: dispatch.error }, { status: 400 });
  }

  const { data, error } = await admin.rpc(dispatch.fn, dispatch.args);
  if (error) {
    console.error(`[fleet-team-write] ${dispatch.fn} failed`, error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  // Wrappers return jsonb like {ok:false,error:'unknown_role'} on domain errors.
  if (data && typeof data === 'object' && (data as any).ok === false) {
    return NextResponse.json(data, { status : 422 });
  }
  return NextResponse.json(data ?? { ok: true });
}
