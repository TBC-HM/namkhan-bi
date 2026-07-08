// app/api/sop/agent-instructions/save/route.ts
// PBS 2026-07-08: Save a new active version of the SOP generator's system
// prompt via public.fn_sop_agent_instructions_save. Previous active row is
// flipped inactive; the new row is v_prev+1.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  body:        string;
  updated_by?: string;
  scope?:      string;   // defaults to 'all'
}

export async function POST(req: Request) {
  try {
    const b = await req.json() as Body;
    const body    = String(b.body ?? '').trim();
    const by      = b.updated_by ? String(b.updated_by).trim() : null;
    const scope   = b.scope ? String(b.scope).trim() : 'all';
    if (!body) return NextResponse.json({ error: 'body is required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_sop_agent_instructions_save', {
      p_body:       body,
      p_updated_by: by,
      p_scope:      scope,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
