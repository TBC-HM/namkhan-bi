// app/api/cockpit/briefs/answer/route.ts
// Answer an open_question on a needs_input brief.
// Calls fn_answer_brief_question(slug, choice) → appends OWNER ANSWER to content_md, status → 'ready'.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  const { slug, choice } = await req.json() as { slug: string; choice: string };
  if (!slug || !choice) return NextResponse.json({ error: 'slug and choice required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_answer_brief_question', { p_slug: slug, p_choice: choice });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
