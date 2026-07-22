// app/api/marketing/audience/group-upsert/route.ts
// POST — create or rename a subscriber group.
// PBS 2026-07-21.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const body = await req.json().catch(() => ({}));
  const group_id = typeof body?.group_id === 'string' && body.group_id ? body.group_id : null;
  const name = typeof body?.name === 'string' ? body.name : null;
  const description = typeof body?.description === 'string' ? body.description : null;

  const { data, error } = await sb.rpc('fn_subscriber_group_upsert', {
    p_group_id: group_id,
    p_name: name,
    p_description: description,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  const res = data as any;
  if (!res?.ok) return NextResponse.json({ ok: false, error: res?.error ?? 'upsert_failed' }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.id });
}
