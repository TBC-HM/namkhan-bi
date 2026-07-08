// app/api/sop/agent-instructions/restore/route.ts
// PBS 2026-07-08: Restore an older version of the SOP generator system prompt
// via public.fn_sop_agent_instructions_restore. Flips all other versions
// (in the same scope) inactive; marks the requested id active.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { id: number }

export async function POST(req: Request) {
  try {
    const b = await req.json() as Body;
    const id = Number(b.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_sop_agent_instructions_restore', {
      p_id: id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
