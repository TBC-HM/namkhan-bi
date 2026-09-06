// app/api/marketing/social/programs/route.ts
// Programs CRUD: list / upsert / soft-delete.
// Calls fn_social_program_upsert and fn_social_program_delete (SECURITY DEFINER).
// Auth: requirePropertyAccess (L22).
//
// GET  ?property_id=&platform=  → { programs: SocialProgram[] }
// POST { property_id, platform?, category_code, label, weekday_slots, posts_per_week, notes?, active?, id? }
//      → { id: number }
// DELETE ?property_id=&id=       → { ok: true }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (!q.get('property_id')) return NextResponse.json({ error: 'property_id required' }, { status: 400 });
  const propertyId = await requirePropertyAccess(req, q.get('property_id'));
  const platform = q.get('platform') ?? null;

  const sb = getSupabaseAdmin();
  let query = sb.from('v_social_programs').select('*').eq('property_id', propertyId).eq('active', true);
  if (platform) query = query.eq('platform', platform);
  const { data, error } = await query.order('platform').order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ programs: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 });
  const propertyId = await requirePropertyAccess(req, body.property_id);

  const { category_code, label, weekday_slots, posts_per_week, platform, notes, active, id } = body;
  if (!category_code || !label || !weekday_slots || posts_per_week == null) {
    return NextResponse.json({ error: 'category_code, label, weekday_slots, posts_per_week required' }, { status: 400 });
  }
  if (!id && !platform) {
    return NextResponse.json({ error: 'platform required when creating a new program' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_social_program_upsert', {
    p_property_id:   propertyId,
    p_platform:      platform ?? null,
    p_category_code: category_code,
    p_label:         label,
    p_weekday_slots: weekday_slots,
    p_posts_per_week: posts_per_week,
    p_notes:         notes ?? null,
    p_active:        active !== false,
    p_id:            id ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data });
}

export async function DELETE(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (!q.get('property_id')) return NextResponse.json({ error: 'property_id required' }, { status: 400 });
  if (!q.get('id')) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const propertyId = await requirePropertyAccess(req, q.get('property_id'));
  const id = Number(q.get('id'));
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('fn_social_program_delete', {
    p_property_id: propertyId,
    p_id: id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
