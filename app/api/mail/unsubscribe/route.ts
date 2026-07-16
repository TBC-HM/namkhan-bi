// app/api/mail/unsubscribe/route.ts
// PBS 2026-07-15 · Item 6 — server-side unsubscribe helper.
// POST body: { messageId: string, sender?: string }
// 1. Fetch the message's List-Unsubscribe header via Gmail API.
// 2. If URL: POST it (some senders accept POST via `List-Unsubscribe-Post`). Fall back to GET.
// 3. If mailto: send an empty email via existing gmail send.
// 4. Also creates a routing rule (route_to='hide') for the sender so future mail is filtered.
// Returns { ok, method, target, rule_id }.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, getMessage, refreshIfExpired, sendMessage } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function extractSenderEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  let body: { messageId?: string; sender?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const messageId = (body.messageId || '').trim();
  if (!messageId) return NextResponse.json({ ok: false, error: 'missing_message_id' }, { status: 400 });

  let unsubHeader = '';
  let unsubPost = '';
  let senderEmail = (body.sender || '').toLowerCase();
  try {
    const msg = await getMessage(user.id, messageId);
    // Header map is normalised to lowercase keys.
    unsubHeader = String(msg.headers['list-unsubscribe'] || '').trim();
    unsubPost   = String(msg.headers['list-unsubscribe-post'] || '').trim();
    if (!senderEmail) senderEmail = extractSenderEmail(String(msg.from || ''));
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'fetch_message_failed', detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  let method = '';
  let target = '';
  let attemptError: string | null = null;

  // Parse header: `<url1>, <mailto:x@y>` — order matters, prefer HTTP.
  const parts = unsubHeader.split(',').map((s) => s.trim().replace(/^<|>$/g, ''));
  const url = parts.find((p) => /^https?:/i.test(p));
  const mailto = parts.find((p) => /^mailto:/i.test(p));

  if (url) {
    method = 'http';
    target = url;
    try {
      // RFC 8058 · One-Click POST when List-Unsubscribe-Post is present.
      if (/one-click/i.test(unsubPost)) {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: 'List-Unsubscribe=One-Click',
        });
        if (!r.ok && r.status !== 202) attemptError = 'http_post_' + r.status;
      } else {
        const r = await fetch(url, { method: 'GET' });
        if (!r.ok && r.status !== 202 && r.status !== 302) attemptError = 'http_get_' + r.status;
      }
    } catch (e) {
      attemptError = e instanceof Error ? e.message : 'http_fetch_failed';
    }
  } else if (mailto) {
    method = 'mailto';
    target = mailto;
    try {
      // PBS 2026-07-16 · sendMessage signature is { from, to, subject, body_html, body_plain? }
      // — the earlier `body: 'unsubscribe'` was a type mismatch that failed tsc.
      const { access, gmail } = await refreshIfExpired(user.id);
      const to = mailto.replace(/^mailto:/i, '').split('?')[0];
      const qMatch = mailto.match(/subject=([^&]+)/i);
      const subject = qMatch ? decodeURIComponent(qMatch[1]) : 'unsubscribe';
      await sendMessage(access, {
        from: gmail,
        to,
        subject,
        body_html: '<p>unsubscribe</p>',
        body_plain: 'unsubscribe',
      });
    } catch (e) {
      attemptError = e instanceof Error ? e.message : 'mailto_send_failed';
    }
  }

  // Always add a `hide` routing rule for the sender so future mail is filtered
  // out of Direct/Inbox lists even if the unsubscribe call fails.
  let ruleId: number | null = null;
  if (senderEmail) {
    try {
      const sb = getSupabaseAdmin();
      const { data } = await sb
        .from('mail_routing_rules')
        .upsert(
          { user_id: user.id, match_type: 'from_email', match_value: senderEmail, route_to: 'hide', active: true },
          { onConflict: 'user_id,match_type,match_value' },
        )
        .select('id')
        .single();
      ruleId = data?.id ?? null;
    } catch { /* silent */ }
  }

  return NextResponse.json({
    ok: !attemptError || !!ruleId,
    method,
    target,
    rule_id: ruleId,
    sender: senderEmail,
    warn: attemptError,
    had_header: !!unsubHeader,
  });
}
