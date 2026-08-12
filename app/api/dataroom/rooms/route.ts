// app/api/dataroom/rooms/route.ts — internal cockpit: list + create rooms.
// Brief dataroom-module-v1. Auth: middleware gates /api/dataroom (session
// required). Reads via public.v_dataroom_rooms bridge; writes via
// service_role-only RPC fn_dataroom_create_room.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get('level') ?? 'property';
  const rawPropertyId = req.nextUrl.searchParams.get('property_id');
  const sb = getSupabaseAdmin();
  let q = sb.from('v_dataroom_rooms').select('*').order('created_at', { ascending: false });
  if (level === 'holding') {
    q = q.eq('owner_level', 'holding');
  } else if (rawPropertyId) {
    // ADR-281 L22: enforce property access
    const propertyId = await requirePropertyAccess(req, rawPropertyId);
    q = q.eq('owner_level', 'property').eq('property_id', propertyId);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rooms: data ?? [] });
}

export async function POST(req: NextRequest) {
  let body: {
    owner_level?: string; property_id?: number | null; slug?: string;
    name?: string; template?: string;
  } = {};
  try { body = await req.json(); } catch {}
  const name = (body.name ?? '').trim();
  const level = body.owner_level === 'holding' ? 'holding' : 'property';
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
  if (level === 'property' && !body.property_id) {
    return NextResponse.json({ error: 'property_id_required' }, { status: 400 });
  }

  let propertyId: number | null = null;
  if (level === 'property') {
    // ADR-281 L22: enforce property access
    propertyId = await requirePropertyAccess(req, body.property_id);
  }

  const slug = (body.slug ?? name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_dataroom_create_room', {
    p_owner_level: level,
    p_property_id: propertyId,
    p_slug: slug,
    p_name: name,
    p_template: body.template ?? 'custom',
    p_created_by: 'cockpit',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
