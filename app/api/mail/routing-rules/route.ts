// app/api/mail/routing-rules/route.ts
// PBS 2026-07-15 · Items 4+7 — user-editable routing rules for the mail folders.
// GET     → list active rules for the current user (v_mail_routing_rules).
// POST    → { match_type, match_value, route_to, custom_folder? } → fn_routing_rule_upsert.
//           PBS 2026-07-16 · Item 1 — POST now also backfills up to 500
//           historical matching messages: creates the NBI/<Foldername> label
//           on demand, applies it via batchModify, and removes INBOX for
//           newsletter/spam/hide so those routes vanish from Inbox view.
// DELETE  → ?id=123 → fn_routing_rule_delete.
// PATCH   → ?id=123 body { active: bool } → fn_routing_rule_toggle.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getCurrentAuthUser,
  searchAllMessageIds,
  getOrCreateLabel,
  batchModifyMessages,
} from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MATCH_TYPES = ['from_email','from_domain','subject_contains','list_id'];
const ROUTE_TO    = ['newsletter','spam','cloudbeds','lighthouse','answer_expected','important','custom','hide'];

// PBS 2026-07-16 · Item 1 — routes that should be hidden from Inbox view.
const REMOVE_INBOX_FOR = new Set<string>(['newsletter','spam','hide']);

// Map route_to → Gmail label name applied during backfill.
function labelForRoute(route_to: string, custom_folder: string | null): string {
  if (route_to === 'custom' && custom_folder) return 'NBI/' + custom_folder.trim();
  const table: Record<string, string> = {
    newsletter:      'NBI/Newsletter',
    cloudbeds:       'NBI/Cloudbeds',
    lighthouse:      'NBI/Lighthouse',
    spam:            'NBI/Spam',
    important:       'NBI/Important',
    hide:            'NBI/Hidden',
    answer_expected: 'NBI/Answer',
  };
  return table[route_to] || 'NBI/Misc';
}

// Build the Gmail search query for backfill from a routing rule.
function backfillQueryFor(match_type: string, match_value: string): string {
  const v = match_value.trim().toLowerCase();
  if (!v) return '';
  if (match_type === 'from_email' || match_type === 'from_domain') return 'from:' + v;
  if (match_type === 'subject_contains') return 'subject:"' + v.replace(/"/g, '\\"') + '"';
  if (match_type === 'list_id') return 'list:' + v;
  return '';
}

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
  const ruleId = data?.id ?? null;

  // PBS 2026-07-16 · Item 1 — historical backfill. Best-effort: label + optionally
  // remove INBOX on up to 500 matching messages. Never blocks the upsert response
  // on the error path (returns backfilled_count=0 with backfill_error surfaced).
  let backfilled_count = 0;
  let backfill_error: string | null = null;
  try {
    const q = backfillQueryFor(match_type, match_value);
    if (q) {
      const labelName = labelForRoute(route_to, custom_folder);
      const labelId   = await getOrCreateLabel(user.id, labelName);
      const ids       = await searchAllMessageIds(user.id, { q, maxTotal: 500 });
      const removeInbox = REMOVE_INBOX_FOR.has(route_to);
      const add    = [labelId];
      const remove = removeInbox ? ['INBOX'] : [];
      backfilled_count = await batchModifyMessages(user.id, ids, add, remove);
    }
  } catch (e) {
    backfill_error = e instanceof Error ? e.message : 'backfill_failed';
  }

  return NextResponse.json({ ok: true, rule_id: ruleId, id: ruleId, backfilled_count, backfill_error });
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
