// app/api/marketing/media/guardrails/naming/route.ts
// PBS 2026-07-14 · Task B — Photo naming conventions read + upsert.
// Reuses public.fn_media_naming_convention_upsert (already SECURITY DEFINER).
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('v_media_naming_conventions')
      .select('*')
      .or('scope.eq.photo,scope.is.null')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 502 });
    return NextResponse.json({ ok:true, data: data ?? [] });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message ?? 'unknown' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok:false, error: 'invalid_json' }, { status: 400 }); }
  const { id, property_id, scope, pattern, examples, description, active } = body ?? {};
  if (!pattern || typeof pattern !== 'string') {
    return NextResponse.json({ ok:false, error: 'pattern required' }, { status: 400 });
  }
  try {
    const sb = getSupabaseAdmin();
    const examplesArr = Array.isArray(examples) ? examples.map(String).filter(Boolean) : null;
    const { data, error } = await sb.rpc('fn_media_naming_convention_upsert', {
      p_id: id ?? null,
      p_property_id: property_id ?? null,
      p_scope: scope ?? 'photo',
      p_pattern: pattern,
      p_examples: examplesArr,
      p_description: description ?? null,
      p_active: active ?? true,
    });
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });
    const res = data as any;
    if (!res?.ok) return NextResponse.json({ ok:false, error: res?.error ?? 'upsert_failed' }, { status: 400 });
    return NextResponse.json({ ok:true, data: res.row });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message ?? 'unknown' }, { status: 500 });
  }
}
