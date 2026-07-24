import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { doc_type, goal_precise, completion_pct } = await req.json();
    if (!doc_type) return NextResponse.json({ error: 'doc_type required' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { error } = await sb.rpc('fn_module_status_upsert', {
      p_doc_type: doc_type,
      p_goal_precise: goal_precise ?? null,
      p_completion_pct: completion_pct ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
