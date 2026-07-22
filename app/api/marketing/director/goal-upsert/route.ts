// app/api/marketing/director/goal-upsert/route.ts
// PBS 2026-07-22 · Editorial Goals panel wiring — fixes "Add failed: 404".
// Wraps fn_director_goal_upsert + fn_director_goal_delete (SECURITY DEFINER).
// The Settings panel at /h/[pid]/settings/property/audience uses this route to
// add/edit/toggle/delete director goals (marketing.director_goals).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const property_id = Number(body?.property_id);
  const goal_key   = String(body?.goal_key ?? '').trim();
  const goal_label = String(body?.goal_label ?? '').trim();
  const weight     = Number.isFinite(Number(body?.weight)) ? Number(body.weight) : 0;
  const active     = body?.active !== false;

  if (!property_id || !Number.isFinite(property_id)) {
    return NextResponse.json({ ok: false, error: 'property_id required' }, { status: 400 });
  }
  if (!goal_key || !goal_label) {
    return NextResponse.json({ ok: false, error: 'goal_key and goal_label required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_director_goal_upsert', {
    p_property_id: property_id,
    p_goal_key: goal_key,
    p_goal_label: goal_label,
    p_weight: weight,
    p_active: active,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id'));
  if (!id || !Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_director_goal_delete', { p_id: id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: data === true });
}
