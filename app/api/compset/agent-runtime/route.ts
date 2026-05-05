// POST /api/compset/agent-runtime
// Replaces an agent's runtime_settings JSON via the
// public.compset_update_agent_runtime(text, jsonb) RPC. Returns the new
// runtime_settings as stored.
//
// Body: { agent_code: string, runtime_settings: object }
//
// Validation: agent_code must be one of the two compset agents (defense in
// depth — the RPC also restricts to compset agents). runtime_settings must be
// a plain object (not array, not null).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_AGENTS = new Set(['compset_agent', 'comp_discovery_agent']);

export async function POST(req: Request) {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'admin client unavailable' },
      { status: 500 },
    );
  }

  let body: { agent_code?: unknown; runtime_settings?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const agentCode = typeof body.agent_code === 'string' ? body.agent_code : '';
  if (!ALLOWED_AGENTS.has(agentCode)) {
    return NextResponse.json(
      {
        ok: false,
        error: `agent_code must be one of: ${[...ALLOWED_AGENTS].join(', ')}`,
      },
      { status: 400 },
    );
  }

  const rs = body.runtime_settings;
  if (!rs || typeof rs !== 'object' || Array.isArray(rs)) {
    return NextResponse.json(
      { ok: false, error: 'runtime_settings must be a JSON object.' },
      { status: 400 },
    );
  }

  const { data, error } = await admin.rpc('compset_update_agent_runtime', {
    p_agent_code: agentCode,
    p_runtime_settings: rs as Record<string, unknown>,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, runtime_settings: data });
}
