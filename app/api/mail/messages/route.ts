// app/api/mail/messages/route.ts
// GET: list Gmail messages for the current user, filtered by label + query.
// Params: ?label=INBOX (default), &q=... (Gmail search syntax), &pageToken=..., &max=50
// PBS 2026-07-15 · Item 5+7 — when folder=to_me, fold user routing rules
// (route_to in ('newsletter','spam','hide','cloudbeds','lighthouse')) into
// the Gmail query as `-from:` exclusions so Direct stays strict.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, listMessagesInLabel } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECT_EXCLUDE_ROUTES = new Set(['newsletter','spam','hide','cloudbeds','lighthouse']);

export async function GET(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const label = req.nextUrl.searchParams.get('label') || 'INBOX';
  const qRaw = req.nextUrl.searchParams.get('q') || '';
  const folder = req.nextUrl.searchParams.get('folder') || '';
  const pageToken = req.nextUrl.searchParams.get('pageToken') || undefined;
  const max = Number(req.nextUrl.searchParams.get('max') || '50');

  // Fold user routing rules into `q` when Direct/to_me is active.
  let q = qRaw;
  if (folder === 'to_me' || /to:me\s+-cc:me/i.test(qRaw)) {
    try {
      const sb = getSupabaseAdmin();
      const { data } = await sb
        .from('mail_routing_rules')
        .select('match_type,match_value,route_to')
        .eq('user_id', user.id)
        .eq('active', true);
      const parts: string[] = [];
      for (const r of (data || [])) {
        if (!DIRECT_EXCLUDE_ROUTES.has(String(r.route_to))) continue;
        if (r.match_type === 'from_email' || r.match_type === 'from_domain') {
          parts.push('-from:' + String(r.match_value).toLowerCase());
        } else if (r.match_type === 'subject_contains') {
          parts.push('-subject:"' + String(r.match_value).replace(/"/g, '\\"') + '"');
        } else if (r.match_type === 'list_id') {
          parts.push('-list:' + String(r.match_value).toLowerCase());
        }
      }
      if (parts.length) q = (q ? q + ' ' : '') + parts.join(' ');
    } catch { /* silent — Direct still works with base query */ }
  }

  try {
    const data = await listMessagesInLabel(user.id, label, q || undefined, pageToken, Number.isFinite(max) ? max : 50);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'list_failed';
    if (msg === 'not_connected') return NextResponse.json({ ok: false, error: 'not_connected' }, { status: 404 });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
