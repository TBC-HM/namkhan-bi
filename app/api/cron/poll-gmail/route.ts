// GET /api/cron/poll-gmail
// Vercel Cron entrypoint. For each row in marketing.user_gmail_connections (not paused):
//  1. Resolve the refresh_token from the Supabase vault (fn_get_gmail_refresh_token
//     RPC — SECRETS LAW, sales_module round 4) with a legacy column fallback
//  2. Mint a fresh access_token via that refresh_token
//  3. List messages matching `q=after:YYYY/MM/DD` since last_synced_at (or 2026-01-01 first run)
//  4. Page through (bounded pageToken loop, max 5 pages = 500 msgs/mailbox/run);
//     for each message, fetch full content
//  5. Insert into sales.email_messages (dedupe by message_id) — re-uses the
//     same logic as /api/sales/email-ingest by sharing the parser/triager helpers
//  6. Write one sales.gmail_poll_runs row per mailbox per run (kills the
//     rule-883 false-green class: health is visible in the DB, not just net._http_response)
//
// Auth: query param ?key=<CRON_SECRET> OR Vercel's automatic Authorization
// header (Vercel cron sends Bearer <CRON_SECRET>).
//
// Manual trigger: hit the URL with ?key=... ?force_email=pb@thenamkhan.com&since=2026-01-01

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import {
  refreshAccessToken,
  listMessages,
  getGmailMessage,
  getHeader,
  extractBodies,
  GmailMessageFull,
} from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — backfill can take a while

const NAMKHAN_DOMAIN_RE = /@(thenamkhan|namkhan)\.com\s*$/i;
const ANY_EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const MAX_PAGES_PER_RUN = 5;      // bounded pageToken loop (sales_module round 4)
const MAX_MSGS_PER_RUN = 500;     // 5 pages x 100 msgs — clears backlog tails without unbounded runs

// ---- helpers (small versions; bigger versions live in /api/sales/email-ingest) ----

function detectIntendedMailbox(toEmails: string[], ccEmails: string[], bodyText: string, fallback: string): string {
  const all = [...toEmails, ...ccEmails].map(s => s.toLowerCase().trim()).flatMap(s => s.match(ANY_EMAIL_RE) ?? [s]);
  const headerHit = all.find(a => NAMKHAN_DOMAIN_RE.test(a));
  if (headerHit) return headerHit;
  if (bodyText) {
    const m = bodyText.toLowerCase().match(/(?:^|\n)(?:to|delivered-to|original-recipient|x-original-to):\s*[^\n]*?([\w.+-]+@(?:thenamkhan|namkhan)\.com)/i);
    if (m && m[1]) return m[1].toLowerCase();
    const bodyHit = (bodyText.slice(0, 2000).match(ANY_EMAIL_RE) ?? []).map(s => s.toLowerCase()).find(a => NAMKHAN_DOMAIN_RE.test(a));
    if (bodyHit) return bodyHit;
  }
  return fallback;
}
function parseFromHeader(raw: string | null): { name: string | null; email: string | null } {
  if (!raw) return { name: null, email: null };
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/) ?? raw.match(/^\s*([^<\s]+@[^>\s]+)\s*$/);
  if (!m) return { name: null, email: null };
  if (m.length === 3) return { name: (m[1] || '').trim() || null, email: (m[2] || '').trim().toLowerCase() };
  return { name: null, email: (m[1] || '').trim().toLowerCase() };
}
function parseAddressList(raw: string | null): string[] {
  if (!raw) return [];
  return (raw.match(ANY_EMAIL_RE) ?? []).map(s => s.toLowerCase());
}
function detectLanguage(text: string): string {
  const t = (text || '').slice(0, 500).toLowerCase();
  if (/\b(bonjour|merci|nous sommes|j'aimerais|réservation)\b/.test(t)) return 'FR';
  if (/\b(guten tag|wir sind|grüße|hallo|reservierung)\b/.test(t)) return 'DE';
  if (/\b(hola|nosotros|gracias|reserva|saludos)\b/.test(t)) return 'ES';
  if (/[一-鿿]/.test(t)) return 'ZH';
  if (/[぀-ヿ]/.test(t)) return 'JA';
  if (/[฀-๿]/.test(t)) return 'TH';
  return 'EN';
}
function triage(subject: string, body: string): { kind: string; conf: number } {
  const t = `${subject} ${body}`.toLowerCase();
  const score = (re: RegExp) => (t.match(re) ?? []).length;
  const tally: Array<[string, number]> = [
    ['group',   score(/\b(group|conference|delegation|company|corporate|team)\b/g) + (score(/\b(\d{2,})\s*(rooms?|guests?|pax)\b/g) > 0 ? 2 : 0)],
    ['wedding', score(/\b(wedding|nuptial|bride|groom|ceremony|reception)\b/g) * 2],
    ['retreat', score(/\b(retreat|yoga|meditation|wellness|silent|workshop)\b/g) * 2],
    ['package', score(/\b(package|bundle|all[- ]?inclusive|honeymoon)\b/g)],
    ['b2b',     score(/\b(agent|wholesaler|operator|tour|allotment|net rate|contract|dmc)\b/g) * 2],
    ['ota',     score(/\b(booking\.com|expedia|agoda|trip\.com|airbnb)\b/g) * 3],
    ['fit',     score(/\b(family|couple|honeymoon|us 2|just the two)\b/g)],
  ];
  tally.sort((a, b) => b[1] - a[1]);
  const top = tally[0];
  if (top[1] === 0) return { kind: 'fit', conf: 0.5 };
  const total = tally.reduce((s, [, n]) => s + n, 0);
  return { kind: top[0], conf: Number((Math.min(0.95, 0.55 + (top[1] / Math.max(1, total)) * 0.4)).toFixed(2)) };
}
function sourceFromMailbox(m: string): string {
  const t = m.toLowerCase();
  if (t.includes('book@')) return 'Direct email';
  if (t.includes('reservations@')) return 'Reservations';
  if (t.includes('wm@')) return 'Wholesale/B2B';
  return 'Direct email';
}

// ---- core ingest of one Gmail message ----

type IngestResult = { kind: 'inserted'|'duplicate'|'error'; error?: string };

async function ingestOne(msg: GmailMessageFull, fallbackMailbox: string): Promise<IngestResult> {
  const sb = getSupabaseAdmin();
  const headers = msg.payload?.headers ?? [];
  const messageIdHdr = getHeader(msg.payload, 'Message-ID') ?? `gmail:${msg.id}`;
  const fromHdr = getHeader(msg.payload, 'From');
  const toHdr = getHeader(msg.payload, 'To');
  const ccHdr = getHeader(msg.payload, 'Cc');
  const subject = getHeader(msg.payload, 'Subject') ?? '';
  const inReplyTo = getHeader(msg.payload, 'In-Reply-To');
  const dateHdr = getHeader(msg.payload, 'Date');
  const receivedAt = dateHdr ? new Date(dateHdr).toISOString() : (msg.internalDate ? new Date(parseInt(msg.internalDate, 10)).toISOString() : new Date().toISOString());

  // Dedupe
  const { data: existing } = await sb.schema('sales').from('email_messages')
    .select('id').eq('property_id', PROPERTY_ID).eq('message_id', messageIdHdr).maybeSingle();
  if (existing) return { kind: 'duplicate' };

  const { text, html } = extractBodies(msg.payload);
  const sender = parseFromHeader(fromHdr);
  const toList = parseAddressList(toHdr);
  const ccList = parseAddressList(ccHdr);
  const intendedMailbox = detectIntendedMailbox(toList, ccList, text, fallbackMailbox);
  const direction = sender.email && NAMKHAN_DOMAIN_RE.test(sender.email) ? 'outbound' : 'inbound';
  const triageResult = triage(subject, text);
  const language = detectLanguage(text);
  const source = direction === 'inbound' ? sourceFromMailbox(intendedMailbox) : 'Internal';

  // Insert matches the REAL sales.email_messages schema (mailbox NOT NULL,
  // from_email/from_name/to_emails/cc_emails/gmail_msg_id) — the previous
  // rewrite inserted sender_email/triaged_kind/language/source/tags columns
  // that do not exist, so every ingest errored silently (ingested always 0).
  void triageResult; void language; void source; // computed for future triage step; not stored here
  const { error } = await sb.schema('sales').from('email_messages').insert({
    property_id: PROPERTY_ID,
    message_id: messageIdHdr,
    thread_id: msg.threadId,
    in_reply_to: inReplyTo,
    direction,
    mailbox: intendedMailbox,
    from_email: sender.email,
    from_name: sender.name,
    to_emails: toList,
    cc_emails: ccList,
    subject,
    body_text: text || null,
    body_html: html || null,
    received_at: receivedAt,
    gmail_msg_id: msg.id,
    intended_mailbox: intendedMailbox,
    ingest_source: 'cron.poll-gmail',
  });
  if (error) return { kind: 'error', error: error.message };
  return { kind: 'inserted' };
}

// ---- refresh-token resolution (SECRETS LAW, sales_module round 4) ----
// The executing path no longer trusts plaintext in marketing.user_gmail_connections:
// tokens live in the Supabase vault as gmail_refresh_token:<address> secrets and
// are read through the service-role-only RPC fn_get_gmail_refresh_token. The
// column now stores the sentinel 'vaulted'; the legacy fallback only fires for
// a real-looking token (transition safety for a connection not yet vaulted).
async function resolveRefreshToken(sb: ReturnType<typeof getSupabaseAdmin>, email: string, columnToken: string | null): Promise<string | null> {
  try {
    const { data, error } = await sb.rpc('fn_get_gmail_refresh_token', { p_email: email });
    if (!error && typeof data === 'string' && data.length > 20) return data;
  } catch { /* fall through to column fallback */ }
  if (columnToken && columnToken.length > 20 && columnToken !== 'vaulted') return columnToken;
  return null;
}

// ---- run logging (kills rule-883 false-greens) ----
async function logPollRun(sb: ReturnType<typeof getSupabaseAdmin>, row: {
  email: string; startedAt: string; status: 'success' | 'error';
  seen: number; inserted: number; skipped: number; error?: string;
}): Promise<void> {
  try {
    await sb.schema('sales').from('gmail_poll_runs').insert({
      email: row.email,
      started_at: row.startedAt,
      finished_at: new Date().toISOString(),
      status: row.status,
      messages_seen: row.seen,
      messages_inserted: row.inserted,
      messages_skipped: row.skipped,
      error_message: row.error ?? null,
    });
  } catch { /* logging must never break the poll */ }
}

// ---- GET handler ----

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Auth — accepts BOTH contracts (sales_module round 3, 2026-08-24):
  //  - Vercel-cron style: ?key=CRON_SECRET or Authorization: Bearer CRON_SECRET
  //  - pg_cron platform style: x-cron-secret header (or ?secret=) matching
  //    CRON_SHARED_SECRET (CRON_SECRET fallback) — same gate as every other
  //    /api/cron/* shim. The pg_cron job sales-gmail-poll-15min sends
  //    x-cron-secret with the vault CRON_SHARED_SECRET; the previous
  //    Bearer-only gate 401'd it and killed the mail spine.
  const key = url.searchParams.get('key');
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET ?? '';
  const sharedSecret = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET ?? '';
  const cronHeader = request.headers.get('x-cron-secret') ?? url.searchParams.get('secret');
  if (!secret && !sharedSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  }
  const keyMatch = !!secret && key === secret;
  const bearerMatch = !!secret && !!authHeader && authHeader.startsWith('Bearer ') && authHeader.slice(7) === secret;
  const sharedMatch = !!sharedSecret && cronHeader === sharedSecret;
  if (!keyMatch && !bearerMatch && !sharedMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const forceEmail = url.searchParams.get('force_email');
  const forceSince = url.searchParams.get('since');

  const sb = getSupabaseAdmin();
  // Fetch active connections
  let query = sb.schema('marketing').from('user_gmail_connections').select('*');
  // Column is gmail_address (NOT email) — conn.email was always undefined,
  // which silently broke force_email filtering + last_synced_at updates.
  if (forceEmail) query = query.eq('gmail_address', forceEmail);
  const { data: connections, error: fetchError } = await query;
  if (fetchError) {
    return NextResponse.json({ error: `Failed to fetch connections: ${fetchError.message}` }, { status: 500 });
  }
  if (!connections || connections.length === 0) {
    return NextResponse.json({ note: 'No gmail connections to poll', processed: [] });
  }

  const results: Array<{ email: string; ingested: number; skipped?: number; errored?: number; pages?: number; error?: string }> = [];
  for (const conn of connections) {
    const connEmail: string = conn.gmail_address ?? conn.email ?? '';
    const startedAt = new Date().toISOString();
    if (conn.paused && !forceEmail) {
      results.push({ email: connEmail, ingested: 0, error: 'paused' });
      continue;
    }
    // Resolve refresh token (vault-first) + mint access token
    let accessToken: string;
    try {
      const refreshToken = await resolveRefreshToken(sb, connEmail, conn.refresh_token ?? null);
      if (!refreshToken) throw new Error('no refresh token in vault or column');
      const tokens = await refreshAccessToken(refreshToken);
      accessToken = tokens.access_token;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ email: connEmail, ingested: 0, error: `Refresh failed: ${msg}` });
      await logPollRun(sb, { email: connEmail, startedAt, status: 'error', seen: 0, inserted: 0, skipped: 0, error: `Refresh failed: ${msg}` });
      continue;
    }
    // Construct Gmail query
    const since = forceSince ?? conn.last_synced_at ?? '2026-01-01';
    const date = since.split('T')[0].replace(/-/g, '/'); // YYYY/MM/DD
    const query = `after:${date}`;
    try {
      let ingested = 0, skipped = 0, errored = 0, seen = 0, pages = 0;
      let firstError: string | undefined;
      // Bounded pageToken loop (round 4): the previous newest-100-only read
      // left backlog tails permanently unreachable once last_synced_at advanced.
      let pageToken: string | undefined;
      do {
        const messageList = await listMessages(accessToken, query, pageToken);
        pages++;
        for (const m of (messageList.messages ?? []).slice(0, MAX_MSGS_PER_RUN - seen)) {
          seen++;
          const full = await getGmailMessage(accessToken, m.id);
          const res = await ingestOne(full, connEmail);
          if (res.kind === 'inserted') ingested++;
          else if (res.kind === 'duplicate') skipped++;
          else { errored++; if (!firstError) firstError = res.error; }
        }
        pageToken = messageList.nextPageToken;
      } while (pageToken && pages < MAX_PAGES_PER_RUN && seen < MAX_MSGS_PER_RUN);
      // Update last_synced_at (keyed by id — the table has no `email` column)
      await sb.schema('marketing').from('user_gmail_connections').update({
        last_synced_at: new Date().toISOString(),
      }).eq('id', conn.id);
      results.push({ email: connEmail, ingested, skipped, errored, pages, ...(firstError ? { error: `first ingest error: ${firstError}` } : {}) });
      await logPollRun(sb, {
        email: connEmail, startedAt, status: errored > 0 && ingested === 0 && skipped === 0 ? 'error' : 'success',
        seen, inserted: ingested, skipped, error: firstError,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ email: connEmail, ingested: 0, error: msg });
      await logPollRun(sb, { email: connEmail, startedAt, status: 'error', seen: 0, inserted: 0, skipped: 0, error: msg });
    }
  }

  return NextResponse.json({ ok: true, processed: results });
}
