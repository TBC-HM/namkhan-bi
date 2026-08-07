// app/api/cockpit/agent-write/route.ts
// PBS 2026-08-07 (ADR-268): the write wrapper the fleet-page CTAs were waiting on.
// Every operation goes through an audited public.fn_* SECURITY DEFINER function —
// no direct table writes from the browser, ever (claude_md §0.5: PostgREST only
// reaches `public`, so the fn_* layer is also the bridge into cockpit/governance).
//
// Each fn_* writes a cockpit.aud_audit_log row keyed on the CANONICAL ROLE, so
// human actions start populating the runs column even before the engine trace
// lands (blocker B1).
//
// Body: { op, ...args }. Returns whatever the function returns: { ok, ... } or
// { ok:false, error }. Validation lives in SQL, not here — one place, not two.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  op?: string;
  role?: string;
  system_prompt?: string;
  note?: string;
  skill_id?: number;
  content?: string;
  importance?: number;
  topics?: string[];
  memory_id?: number;
  reason?: string;
  daily?: number;
  monthly?: number;
  enforced?: boolean;
  status?: string;
};

// op -> [function name, arg builder]. Anything not in this map is rejected.
const OPS: Record<string, (b: Body) => { fn: string; args: Record<string, unknown> }> = {
  set_prompt: (b) => ({
    fn: 'fn_agent_set_prompt',
    args: { p_role: b.role, p_system_prompt: b.system_prompt, p_note: b.note ?? null },
  }),
  grant_skill: (b) => ({
    fn: 'fn_agent_grant_skill',
    args: { p_role: b.role, p_skill_id: Number(b.skill_id) },
  }),
  revoke_skill: (b) => ({
    fn: 'fn_agent_revoke_skill',
    args: { p_role: b.role, p_skill_id: Number(b.skill_id) },
  }),
  add_memory: (b) => ({
    fn: 'fn_agent_add_memory',
    args: {
      p_role: b.role,
      p_content: b.content,
      p_importance: Number(b.importance ?? 8),
      p_topics: Array.isArray(b.topics) ? b.topics : [],
    },
  }),
  archive_memory: (b) => ({
    fn: 'fn_agent_archive_memory',
    args: { p_memory_id: Number(b.memory_id), p_reason: b.reason, p_superseded_by: null },
  }),
  set_budget: (b) => ({
    fn: 'fn_agent_set_budget',
    args: {
      p_role: b.role,
      p_daily: Number(b.daily),
      p_monthly: Number(b.monthly),
      p_enforced: b.enforced !== false,
    },
  }),
  set_status: (b) => ({
    fn: 'fn_agent_set_status',
    args: { p_role: b.role, p_status: b.status },
  }),
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const op = String(body.op ?? '');
  const build = OPS[op];
  if (!build) {
    return NextResponse.json(
      { ok: false, error: `unknown_op: ${op}`, allowed: Object.keys(OPS) },
      { status: 400 },
    );
  }
  if (op !== 'archive_memory' && !body.role) {
    return NextResponse.json({ ok: false, error: 'role_required' }, { status: 400 });
  }

  const { fn, args } = build(body);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc(fn, args);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, fn }, { status: 500 });
  }
  // fn_* return jsonb { ok, ... } — a business-rule rejection is a 200 with ok:false,
  // deliberately: the caller renders the message, it is not a transport failure.
  return NextResponse.json(data ?? { ok: false, error: 'no_result' });
}
