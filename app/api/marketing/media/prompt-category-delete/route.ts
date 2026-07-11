// app/api/marketing/media/prompt-category-delete/route.ts
// POST — delete a media.ai_prompt_categories row via public.fn_ai_prompt_category_delete(key).
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const key = String(body?.key ?? '').trim();
  if (!key) return NextResponse.json({ error: 'missing_key' }, { status: 400 });

  try {
    const { data, error } = await sb.rpc('fn_ai_prompt_category_delete', { p_key: key });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: Boolean(data) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
