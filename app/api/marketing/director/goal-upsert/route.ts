// app/api/marketing/director/goal-upsert/route.ts
// PBS 2026-07-22 v2 · Upsert an editorial goal (weight 0-100, share-of-slots semantic).
// Previous version clamped to 0-10; PBS moved the editor to Property Settings → Audience
// and asked for finer granularity. Backfill migration multiplied existing weights by 10.
//
// POST { property_id, goal_key, goal_label, weight, active } → { ok, id }
// DELETE ?id=... → { ok, deleted }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { property_id?: number; goal_key?: string; goal_label?: string; weight?: number; active?: boolean };
    const pid = Number(body.property_id ?? 260955);
    if (!body.goal_key || typeof body.weight !== 'number') {
      return NextResponse.json({ error: 'goal_key and weight required' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_director_goal_upsert', {
      p_property_id: pid,
      p_goal_key: body.goal_key,
      p_goal_label: body.goal_label ?? body.goal_key,
      p_weight: Math.max(0, Math.min(100, Math.round(body.weight))),
      p_active: body.active ?? true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_director_goal_delete', { p_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: data === true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
