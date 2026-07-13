// app/api/marketing/media/naming-convention-upsert/route.ts
// POST { id?, property_id, scope, pattern, examples, description, active? }
// Upserts a naming convention rule via public.fn_media_naming_convention_upsert.
// PBS 2026-07-13 — v1 QA engine.
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

  const { id, property_id, scope, pattern, examples, description, active } = body ?? {};
  if (!pattern || typeof pattern !== 'string') {
    return NextResponse.json({ error: 'pattern required' }, { status: 400 });
  }
  if (scope != null && scope !== 'photo' && scope !== 'video') {
    return NextResponse.json({ error: 'scope must be photo|video|null' }, { status: 400 });
  }
  const examplesArr = Array.isArray(examples) ? examples.map(String).filter(Boolean) : null;

  const { data, error } = await admin.rpc('fn_media_naming_convention_upsert', {
    p_id: id ?? null,
    p_property_id: property_id ?? null,
    p_scope: scope ?? null,
    p_pattern: pattern,
    p_examples: examplesArr,
    p_description: description ?? null,
    p_active: active ?? true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  const res = data as any;
  if (!res?.ok) return NextResponse.json({ error: res?.error ?? 'upsert_failed' }, { status: 400 });
  return NextResponse.json({ ok: true, row: res.row });
}
