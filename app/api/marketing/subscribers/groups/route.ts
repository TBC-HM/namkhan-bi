// app/api/marketing/subscribers/groups/route.ts
// PBS 2026-07-21 — Subscriber groups CRUD + assign/unassign.
// GET  → list groups from public.v_subscriber_groups (with member_count).
// POST → {action:'create'|'delete'|'assign'|'unassign', ...} routed to fn_subscriber_group_* RPCs.
// SECURITY DEFINER RPCs (marketing schema not PostgREST-exposed; bridge via public.fn_*).
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('v_subscriber_groups')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, groups: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(b.action ?? '');
  const admin = getSupabaseAdmin();

  if (action === 'create') {
    const slug = typeof b.slug === 'string' ? b.slug.trim() : '';
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    const description = typeof b.description === 'string' ? b.description : null;
    const color = typeof b.color === 'string' && b.color ? b.color : '#5A5A5A';
    if (!slug || !name) return NextResponse.json({ ok: false, error: 'slug_and_name_required' }, { status: 400 });
    const { data, error } = await admin.rpc('fn_subscriber_group_create', {
      p_slug: slug, p_name: name, p_description: description, p_color: color,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data });
  }

  if (action === 'delete') {
    const group_id = typeof b.group_id === 'string' ? b.group_id : '';
    if (!group_id) return NextResponse.json({ ok: false, error: 'group_id_required' }, { status: 400 });
    const { error } = await admin.rpc('fn_subscriber_group_delete', { p_group_id: group_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'assign' || action === 'unassign') {
    const ids = Array.isArray(b.subscriber_ids)
      ? (b.subscriber_ids as unknown[]).map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : [];
    const group_id = typeof b.group_id === 'string' ? b.group_id : '';
    if (!ids.length || !group_id) return NextResponse.json({ ok: false, error: 'subscriber_ids_and_group_id_required' }, { status: 400 });
    const fn = action === 'assign' ? 'fn_subscriber_group_assign' : 'fn_subscriber_group_unassign';
    const { data, error } = await admin.rpc(fn, { p_subscriber_ids: ids, p_group_id: group_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, affected: data });
  }

  return NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 });
}
