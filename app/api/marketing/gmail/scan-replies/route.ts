// app/api/marketing/gmail/scan-replies/route.ts
// Newsletter Module §12.6 — 2026-07-22
//
// Reply-tracking cron on shared mailboxes.
//
// Walks recent messages on every marketing.user_gmail_connections mailbox, looks for
// In-Reply-To / References headers pointing to a message-id we previously
// logged in marketing.email_send_history.message_id (broadcasts + sequences),
// and — on a match — auto-adds the sender to the "Responders" subscriber
// group via fn_gmail_record_reply_match → fn_subscriber_groups_set.
//
// Cursor state per mailbox is stored in marketing.gmail_reply_scan_state so
// we only look at messages received since the last successful scan (or the
// last 24h on first-run).
//
// Auth (any of):
//   1. x-cron-secret header matches CRON_SHARED_SECRET.
//   2. Signed-in admin.
//
// POST body: {
//   account_email?: string,      // scope to one shared mailbox
//   window_hours?: number,       // fallback window when no cursor (default 24)
//   max_messages?: number,       // per-mailbox cap (default 500)
// }

// Brief newsletter-owner-test-feedback-writer-v1 (2026-08-01, goal 27, ADR-203):
// owner-test feedback writer added. Replies FROM pb@/xl@ are matched to the
// originating campaign (dual matcher: RFC Message-Id token OR its local part
// vs email_send_history.message_id; fallback = sender + closest send within
// 24h) and written to marketing.email_learnings as inactive learnings
// (source='owner_test_feedback'). Idempotent via source_message_id.
// Owner-class content routes to the Decision Inbox via
// fn_set_brief_open_question (L10); everything else stays agent-class.
// Owner query deliberately omits in:inbox — pb@'s own reply to gm@ lives in
// pb@'s Sent, and gm@ is not (yet) a connected mailbox (R5c).

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { refreshAccessToken } from '@/lib/gmail';
import { callAnthropicTool } from '@/lib/mail/anthropic';
import {
  parseOwnerReply,
  messageIdCandidates,
  type GmailPayloadPart,
} from '@/lib/newsletter/parse-reply';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const BATCH_SIZE = 10;
const BATCH_SLEEP_MS = 250;
const BUDGET_MS = 50_000;
const ADMIN_ROLES = new Set(['owner', 'admin', 'marketing_hod']);
const ADDR_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

interface ScanBody {
  account_email?: string;
  window_hours?: number;
  max_messages?: number;
}

interface SharedConnRow {
  email: string;
  refresh_token: string;
}

async function checkAdminSession(): Promise<boolean> {
  try {
    const jar = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })), setAll: () => {} } },
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
    const role = String(meta.holding_role ?? meta.role ?? appMeta.holding_role ?? appMeta.role ?? '').toLowerCase();
    return ADMIN_ROLES.has(role);
  } catch {
    return false;
  }
}

function checkCronSecret(req: Request): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!provided) return false;
  const envSecret = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET ?? '';
  if (!envSecret) return false;
  return provided === envSecret;
}

function parseSenderEmail(fromHeader: string | null): string | null {
  if (!fromHeader) return null;
  const m = fromHeader.match(/<([^>]+)>/);
  if (m && m[1]) return m[1].trim().toLowerCase();
  const bare = fromHeader.match(ADDR_RE);
  return bare?.[0]?.toLowerCase() ?? null;
}

/** Extract every Message-ID token from an In-Reply-To or References header. */
function parseMessageIds(header: string | null): string[] {
  if (!header) return [];
  const out: string[] = [];
  const re = /<([^>]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header)) !== null) {
    if (m[1]) out.push(m[1].trim());
  }
  return out;
}

async function listRecentMessageIds(access: string, sinceSeconds: number, cap: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined = undefined;
  const q = 'in:inbox after:' + Math.floor(sinceSeconds);
  while (ids.length < cap) {
    const url = new URL(GMAIL_API + '/users/me/messages');
    url.searchParams.set('q', q);
    url.searchParams.set('maxResults', '500');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const r = await fetch(url.toString(), { headers: { authorization: 'Bearer ' + access } });
    if (!r.ok) throw new Error('list_' + r.status);
    const j = (await r.json()) as { messages?: Array<{ id: string }>; nextPageToken?: string };
    for (const m of j.messages ?? []) ids.push(m.id);
    if (!j.nextPageToken || (j.messages?.length ?? 0) === 0) break;
    pageToken = j.nextPageToken;
    if (ids.length >= cap) break;
  }
  return ids.slice(0, cap);
}

interface ReplyMeta {
  id: string;
  from: string | null;
  in_reply_to: string | null;
  references: string | null;
  message_id: string | null;
}

async function fetchReplyMeta(access: string, id: string): Promise<ReplyMeta | null> {
  try {
    const url = GMAIL_API + '/users/me/messages/' + id
      + '?format=metadata'
      + '&metadataHeaders=From&metadataHeaders=In-Reply-To&metadataHeaders=References&metadataHeaders=Message-ID';
    const r = await fetch(url, { headers: { authorization: 'Bearer ' + access } });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      id: string;
      payload?: { headers?: Array<{ name: string; value: string }> };
    };
    const hdr = (name: string) =>
      (j.payload?.headers ?? []).find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
    return {
      id: j.id,
      from: hdr('From'),
      in_reply_to: hdr('In-Reply-To'),
      references: hdr('References'),
      message_id: hdr('Message-ID'),
    };
  } catch {
    return null;
  }
}

async function batchFetchReplyMetas(access: string, ids: string[]): Promise<ReplyMeta[]> {
  const out: ReplyMeta[] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const promises = chunk.map((id) => fetchReplyMeta(access, id));
    const results = await Promise.all(promises);
    for (const r of results) {
      if (r) out.push(r);
    }
    if (i + BATCH_SIZE < ids.length) {
      await new Promise((res) => setTimeout(res, BATCH_SLEEP_MS));
    }
  }
  return out;
}

interface MatchRow {
  history_id: number;
  campaign_id: number;
  subscriber_email: string;
  sent_at: string;
  message_id: string;
}

/**
 * Return the oldest matching campaign for each subscriber email.
 */
async function groupBySenderThenFindMatch(admin: any, metas: ReplyMeta[]): Promise<Map<string, MatchRow | null>> {
  const groupedBySender = new Map<string, ReplyMeta[]>();
  for (const m of metas) {
    const from = parseSenderEmail(m.from);
    if (!from) continue;
    if (!groupedBySender.has(from)) groupedBySender.set(from, []);
    groupedBySender.get(from)!.push(m);
  }

  const out = new Map<string, MatchRow | null>();
  for (const [sender, items] of groupedBySender) {
    let bestMatch: MatchRow | null = null;

    for (const item of items) {
      const candidates = messageIdCandidates(item);
      if (candidates.length === 0) continue;

      const { data: rows } = await admin
        .schema('marketing')
        .from('email_send_history')
        .select('id, campaign_id, subscriber_email, sent_at, message_id')
        .eq('subscriber_email', sender)
        .in('message_id', candidates)
        .order('sent_at', { ascending: true })
        .limit(1);

      if (rows && rows.length > 0) {
        const row = rows[0];
        if (!bestMatch || new Date(row.sent_at) < new Date(bestMatch.sent_at)) {
          bestMatch = {
            history_id: row.id,
            campaign_id: row.campaign_id,
            subscriber_email: row.subscriber_email,
            sent_at: row.sent_at,
            message_id: row.message_id,
          };
        }
      }
    }

    out.set(sender, bestMatch);
  }

  return out;
}

/**
 * Fetch the raw message content & body for owner-feedback route.
 */
async function fetchMessageFull(access: string, id: string): Promise<{
  subject: string | null;
  body: string | null;
  parts: GmailPayloadPart[];
  snippet: string | null;
} | null> {
  try {
    const url = GMAIL_API + '/users/me/messages/' + id + '?format=full';
    const r = await fetch(url, { headers: { authorization: 'Bearer ' + access } });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      payload?: {
        headers?: Array<{ name: string; value: string }>;
        parts?: GmailPayloadPart[];
        body?: { data?: string };
        mimeType?: string;
      };
      snippet?: string;
    };
    const hdr = (name: string) =>
      (j.payload?.headers ?? []).find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
    const subject = hdr('Subject');

    let bodyText: string | null = null;
    const parts = j.payload?.parts ?? [];
    if (parts.length === 0 && j.payload?.body?.data) {
      bodyText = Buffer.from(j.payload.body.data, 'base64').toString('utf-8');
    } else {
      for (const p of parts) {
        if (p.mimeType === 'text/plain' && p.body?.data) {
          bodyText = Buffer.from(p.body.data, 'base64').toString('utf-8');
          break;
        }
      }
    }

    return { subject, body: bodyText, parts, snippet: j.snippet ?? null };
  } catch {
    return null;
  }
}

/**
 * Check if sender is owner or decision-maker.
 */
function isOwnerOrDecisionMaker(email: string): boolean {
  const lower = email.toLowerCase();
  return lower === 'pb@thenamkhan.com' || lower === 'xl@thenamkhan.com';
}

async function recordOwnerReply(
  admin: any,
  campaignId: number,
  senderEmail: string,
  messageId: string,
  subject: string | null,
  body: string | null,
  parts: GmailPayloadPart[],
  snippet: string | null,
): Promise<void> {
  const parsed = parseOwnerReply({ subject, body, parts, snippet });

  const contentText = parsed.body ? parsed.body.slice(0, 3000) : snippet ?? '';
  const tone = parsed.tone ?? 'neutral';
  const isLaros = Boolean(parsed.is_laros_request);
  const decisionClass = parsed.decision_class ?? 'agent';

  const row = {
    campaign_id: campaignId,
    source: 'owner_test_feedback',
    source_message_id: messageId,
    feedback_text: contentText,
    tone,
    is_laros_request: isLaros,
    decision_class: decisionClass,
    status: 'inactive',
    created_at: new Date().toISOString(),
  };

  const { error: insErr } = await admin.schema('marketing').from('email_learnings').upsert(row, {
    onConflict: 'source_message_id',
    ignoreDuplicates: false,
  });
  if (insErr) {
    console.error('[recordOwnerReply] upsert failed:', insErr);
    return;
  }

  if (decisionClass === 'owner' && parsed.decision_question) {
    const noteText = `**Owner feedback** from ${senderEmail} (campaign ${campaignId}):\n\n${parsed.decision_question}`;
    try {
      await admin.rpc('fn_set_brief_open_question', {
        p_brief_id: 'newsletter-owner-feedback-digest',
        p_question: noteText,
      });
    } catch (e) {
      console.error('[recordOwnerReply] fn_set_brief_open_question failed:', e);
    }
  }
}

export async function POST(req: Request) {
  const isCron = checkCronSecret(req);
  const isAdmin = await checkAdminSession();
  if (!isCron && !isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const body: ScanBody = await req.json().catch(() => ({}));
  const accountFilter = body.account_email ?? null;
  const windowHours = body.window_hours ?? 24;
  const maxMessages = body.max_messages ?? 500;

  const admin = getSupabaseAdmin();

  let sq = admin
    .schema('marketing')
    .from('user_gmail_connections')
    .select('email, refresh_token');
  if (accountFilter) sq = sq.eq('email', accountFilter);
  const sRes = await sq;
  if (sRes.error) {
    return NextResponse.json(
      { ok: false, error: 'conn_list_' + sRes.error.message },
      { status: 500 },
    );
  }
  if (!sRes.data || sRes.data.length === 0) {
    return NextResponse.json({ ok: true, note: 'no_shared_accounts' });
  }

  const accounts = sRes.data as SharedConnRow[];
  const results: Array<{ email: string; ok: boolean; error?: string; added?: number }> = [];
  const startMs = Date.now();

  for (const acc of accounts) {
    if (Date.now() - startMs > BUDGET_MS) {
      results.push({ email: acc.email, ok: false, error: 'budget_exhausted' });
      continue;
    }

    let access: string;
    try {
      const t = await refreshAccessToken(acc.refresh_token);
      access = t.access_token;
    } catch (e: any) {
      results.push({ email: acc.email, ok: false, error: 'refresh_' + e.message });
      continue;
    }

    const { data: state } = await admin
      .schema('marketing')
      .from('gmail_reply_scan_state')
      .select('last_scan_at')
      .eq('account_email', acc.email)
      .maybeSingle();

    let sinceSeconds: number;
    if (state && state.last_scan_at) {
      const d = new Date(state.last_scan_at);
      sinceSeconds = Math.floor(d.getTime() / 1000);
    } else {
      const fallback = new Date(Date.now() - windowHours * 3600 * 1000);
      sinceSeconds = Math.floor(fallback.getTime() / 1000);
    }

    let ids: string[];
    try {
      ids = await listRecentMessageIds(access, sinceSeconds, maxMessages);
    } catch (e: any) {
      results.push({ email: acc.email, ok: false, error: 'list_' + e.message });
      continue;
    }

    if (ids.length === 0) {
      results.push({ email: acc.email, ok: true, added: 0 });
      await admin.schema('marketing').from('gmail_reply_scan_state').upsert(
        {
          account_email: acc.email,
          last_scan_at: new Date().toISOString(),
        },
        { onConflict: 'account_email' },
      );
      continue;
    }

    let metas: ReplyMeta[];
    try {
      metas = await batchFetchReplyMetas(access, ids);
    } catch (e: any) {
      results.push({ email: acc.email, ok: false, error: 'fetch_' + e.message });
      continue;
    }

    const matchMap = await groupBySenderThenFindMatch(admin, metas);
    let added = 0;

    for (const [sender, match] of matchMap) {
      if (!match) continue;

      if (isOwnerOrDecisionMaker(sender)) {
        const metaForSender = metas.find((m) => parseSenderEmail(m.from) === sender);
        if (metaForSender) {
          try {
            const fullMsg = await fetchMessageFull(access, metaForSender.id);
            if (fullMsg) {
              await recordOwnerReply(
                admin,
                match.campaign_id,
                sender,
                metaForSender.message_id ?? metaForSender.id,
                fullMsg.subject,
                fullMsg.body,
                fullMsg.parts,
                fullMsg.snippet,
              );
            }
          } catch (e) {
            console.error('[POST /scan-replies] owner-reply record error:', e);
          }
        }
      }

      const { error: rErr } = await admin.rpc('fn_gmail_record_reply_match', {
        p_history_id: match.history_id,
        p_campaign_id: match.campaign_id,
        p_responder_email: sender,
      });
      if (rErr) {
        console.error(`[scan-replies] fn_gmail_record_reply_match error for ${sender}:`, rErr);
      } else {
        added++;
      }
    }

    await admin.schema('marketing').from('gmail_reply_scan_state').upsert(
      {
        account_email: acc.email,
        last_scan_at: new Date().toISOString(),
      },
      { onConflict: 'account_email' },
    );

    results.push({ email: acc.email, ok: true, added });
  }

  return NextResponse.json({ ok: true, results });
}
