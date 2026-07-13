// app/api/marketing/media/naming-convention-delete/route.ts
// POST { id } — delete a naming convention rule via public.fn_media_naming_convention_delete.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const id = body?.id;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await admin.rpc('fn_media_naming_convention_delete', { p_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  const res = data as any;
  if (!res?.ok) return NextResponse.json({ error: res?.error ?? 'delete_failed' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
