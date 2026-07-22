// app/api/marketing/gmail/scan-replies/route.ts
// Newsletter Module §12.6 — 2026-07-22
//
// Reply-tracking cron on shared mailboxes.
//
// Walks recent messages on every sales.gmail_connections mailbox, looks for
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

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { refreshAccessToken } from '@/lib/gmail';

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
    const hdrs = j.payload?.headers ?? [];
    const pick = (n: string) => hdrs.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? null;
    return {
      id: j.id,
      from: pick('From'),
      in_reply_to: pick('In-Reply-To'),
      references: pick('References'),
      message_id: pick('Message-ID'),
    };
  } catch {
    return null;
  }
}

interface MailboxScanResult {
  account_email: string;
  scanned: number;
  candidates: number;
  matched: number;
  new_responders: number;
  error?: string;
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function scanMailbox(
  row: SharedConnRow,
  windowHours: number,
  maxMessages: number,
  budgetStart: number,
): Promise<MailboxScanResult> {
  const admin = getSupabaseAdmin();
  const account = row.email;
  const result: MailboxScanResult = {
    account_email: account,
    scanned: 0,
    candidates: 0,
    matched: 0,
    new_responders: 0,
  };

  let sinceSeconds: number;
  try {
    const { data: cur } = await admin
      .schema('marketing')
      .from('gmail_reply_scan_state')
      .select('last_scanned_at')
      .eq('account_email', account.toLowerCase())
      .maybeSingle();
    const last = cur?.last_scanned_at ? Date.parse(cur.last_scanned_at as string) : 0;
    const fallback = Date.now() - windowHours * 3600 * 1000;
    sinceSeconds = Math.floor(Math.max(last, fallback) / 1000);
  } catch {
    sinceSeconds = Math.floor((Date.now() - windowHours * 3600 * 1000) / 1000);
  }

  let access: string;
  try {
    const t = await refreshAccessToken(row.refresh_token);
    access = t.access_token;
  } catch (err) {
    result.error = 'token_' + (err instanceof Error ? err.message : String(err));
    return result;
  }

  let ids: string[];
  try {
    ids = await listRecentMessageIds(access, sinceSeconds, maxMessages);
  } catch (err) {
    result.error = 'list_' + (err instanceof Error ? err.message : String(err));
    return result;
  }

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    if (Date.now() - budgetStart > BUDGET_MS) break;
    const batch = ids.slice(i, i + BATCH_SIZE);
    const metas = await Promise.all(batch.map((id) => fetchReplyMeta(access, id)));
    for (const meta of metas) {
      if (!meta) continue;
      result.scanned += 1;
      const refIds = [
        ...parseMessageIds(meta.in_reply_to),
        ...parseMessageIds(meta.references),
      ];
      if (refIds.length === 0) continue;

      const { data: hits, error: hitErr } = await admin
        .schema('marketing')
        .from('email_send_history')
        .select('id, message_id, subscriber_email')
        .in('message_id', refIds)
        .limit(5);
      if (hitErr || !hits || hits.length === 0) continue;

      result.candidates += 1;
      const sender = parseSenderEmail(meta.from);
      if (!sender) continue;

      const { data: matchRes, error: matchErr } = await admin.rpc('fn_gmail_record_reply_match', {
        p_sender_email: sender,
        p_message_id: meta.message_id ?? null,
        p_in_reply_to: refIds[0] ?? null,
        p_matched_send_id: (hits[0] as { id: number }).id ?? null,
      });
      if (matchErr) continue;
      const outRow = Array.isArray(matchRes) ? matchRes[0] : matchRes;
      if (outRow?.subscriber_id) {
        result.matched += 1;
        if (outRow.added_to_responders) result.new_responders += 1;
      }
    }
    if (i + BATCH_SIZE < ids.length) await sleep(BATCH_SLEEP_MS);
  }

  await admin.rpc('fn_gmail_reply_scan_state_bump', {
    p_account: account,
    p_matches: result.new_responders,
  });

  return result;
}

export async function POST(req: Request) {
  const cronOk = checkCronSecret(req);
  const adminOk = cronOk ? true : await checkAdminSession();
  if (!cronOk && !adminOk) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: ScanBody = {};
  try { body = (await req.json()) as ScanBody; } catch { body = {}; }
  const windowHours = Math.max(1, Math.min(168, Number(body.window_hours ?? 24)));
  const maxMessages = Math.max(1, Math.min(2000, Number(body.max_messages ?? 500)));
  const accountFilter = body.account_email ? body.account_email.toLowerCase() : null;

  const admin = getSupabaseAdmin();

  let sq = admin
    .schema('sales')
    .from('gmail_connections')
    .select('email, refresh_token');
  if (accountFilter) sq = sq.eq('email', accountFilter);
  const sRes = await sq;
  if (sRes.error) {
    return NextResponse.json(
      { ok: false, error: 'conn_list_' + sRes.error.message },
      { status: 500 },
    );
  }
  const rows = ((sRes.data ?? []) as SharedConnRow[]).filter((r) => !!r.refresh_token);
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, scanned_mailboxes: 0, results: [] });
  }

  const started = Date.now();
  const results: MailboxScanResult[] = [];
  for (const row of rows) {
    if (Date.now() - started > BUDGET_MS) break;
    const r = await scanMailbox(row, windowHours, maxMessages, started);
    results.push(r);
  }

  return NextResponse.json({
    ok: true,
    scanned_mailboxes: results.length,
    total_scanned: results.reduce((a, b) => a + b.scanned, 0),
    total_candidates: results.reduce((a, b) => a + b.candidates, 0),
    total_matched: results.reduce((a, b) => a + b.matched, 0),
    total_new_responders: results.reduce((a, b) => a + b.new_responders, 0),
    results,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST to scan shared mailboxes for replies to logged broadcasts. Header x-cron-secret or admin session required. Body: { account_email?, window_hours?, max_messages? }',
  });
}
