// app/api/cockpit/bugs/answer/route.ts
// Answer an open_question on a needs_human bug.
// Calls fn_answer_bug_question(bug_id, choice) → appends answer to body, status → 'acked'.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  const { bug_id, choice } = await req.json() as { bug_id: number; choice: string };
  if (!bug_id || !choice) return NextResponse.json({ error: 'bug_id and choice required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_answer_bug_question', { p_bug_id: bug_id, p_choice: choice });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
