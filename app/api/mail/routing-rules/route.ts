// app/api/mail/routing-rules/route.ts
// PBS 2026-07-15 · Items 4+7 — user-editable routing rules for the mail folders.
// GET     → list active rules for the current user (v_mail_routing_rules).
// POST    → { match_type, match_value, route_to, custom_folder? } → fn_routing_rule_upsert.
// DELETE  → ?id=123 → fn_routing_rule_delete.
// PATCH   → ?id=123 body { active: bool } → fn_routing_rule_toggle.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentAuthUser } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MATCH_TYPES = ['from_email','from_domain','subject_contains','list_id'];
const ROUTE_TO    = ['newsletter','spam','cloudbeds','lighthouse','answer_expected','important','custom','hide'];

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('mail_routing_rules')
    .select('id,match_type,match_value,route_to,custom_folder,active,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  // Fall back to raw table read via admin (bypasses RLS with service role).
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rules: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  let body: { match_type?: string; match_value?: string; route_to?: string; custom_folder?: string | null } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const match_type = (body.match_type || '').trim();
  const match_value = (body.match_value || '').trim().toLowerCase();
  const route_to = (body.route_to || '').trim();
  const custom_folder = body.custom_folder || null;
  if (!MATCH_TYPES.includes(match_type)) return NextResponse.json({ ok: false, error: 'bad_match_type' }, { status: 400 });
  if (!match_value) return NextResponse.json({ ok: false, error: 'missing_match_value' }, { status: 400 });
  if (!ROUTE_TO.includes(route_to)) return NextResponse.json({ ok: false, error: 'bad_route_to' }, { status: 400 });
  if (route_to === 'custom' && !custom_folder) return NextResponse.json({ ok: false, error: 'missing_custom_folder' }, { status: 400 });

  const sb = getSupabaseAdmin();
  // Direct upsert via admin client (bypasses RLS; user_id set from server-side session).
  const { data, error } = await sb
    .from('mail_routing_rules')
    .upsert(
      { user_id: user.id, match_type, match_value, route_to, custom_folder, active: true },
      { onConflict: 'user_id,match_type,match_value' },
    )
    .select('id')
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id ?? null });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id') || '0');
  if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('mail_routing_rules').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id') || '0');
  if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  let body: { active?: boolean } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const active = !!body.active;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('mail_routing_rules').update({ active }).eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
