// app/api/marketing/contacts/extract/route.ts
// PBS 2026-07-16 — Gmail contact extractor.
//
// Walks every ACTIVE row in BOTH
//   - marketing.user_gmail_connections  (personal per-user mailboxes)
//   - sales.gmail_connections           (shared team mailboxes: book@, gm@,
//                                        reservations@, etc.)
// and extracts every sender/recipient email address from message headers
// (headers only — no bodies, no attachments), deduping into
// marketing.gmail_contacts_extracted with per-contact usage stats.
//
// PBS 2026-07-21 — Extended to shared mailboxes. Personal side and shared side
// share the same aggregation + upsert pipeline via runMessageExtraction().
//
// Auth (any of):
//   1. x-cron-secret header matches vault CRON_SHARED_SECRET (or env fallback).
//   2. Signed-in user with holding_role ∈ ('owner','admin','marketing_hod')
//      per app_metadata / user_metadata on the auth session.
//
// POST body: {
//   account_email?: string,       // extract just this connected mailbox (else all active). Matches either source.
//   max_messages?: number,        // cap per-account scan (default 5000, cron default 2000).
//   include_personal?: boolean,   // default true — walk marketing.user_gmail_connections
//   include_shared?: boolean,     // default true — walk sales.gmail_connections
// }
//
// Response: { ok:true, runs:[{ account_email, source, messages_scanned, new_contacts, updated_contacts, run_id }] }

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { refreshIfExpired } from '@/lib/userGmail';
import { refreshAccessToken } from '@/lib/gmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min hard cap

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const BATCH_SIZE = 10;
const BATCH_SLEEP_MS = 500;
const ADMIN_ROLES = new Set(['owner', 'admin', 'marketing_hod']);
const ADDR_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

interface ExtractBody {
  account_email?: string;
  max_messages?: number;
  include_personal?: boolean;
  include_shared?: boolean;
}

interface PersonalConnRow {
  user_id: string;
  gmail_address: string;
  active: boolean;
}

interface SharedConnRow {
  email: string;
  refresh_token: string;
}

type SourceKind = 'personal' | 'shared';

interface RunResult {
  account_email: string;
  source: SourceKind;
  run_id: string | null;
  messages_scanned: number;
  new_contacts: number;
  updated_contacts: number;
  status: 'succeeded' | 'failed';
  error?: string;
}

interface ContactAggregate {
  email: string;
  display_name: string | null;
  first_seen_at: string;
  last_seen_at: string;
  message_count: number;
  direction_in: number;
  direction_out: number;
  source_accounts: Set<string>;
  labels_touched: Set<string>;
}

// PBS 2026-07-16 — filter out @thenamkhan.com team + noreply/newsletter/notification/ESP addresses
// so the contacts table only shows people we might actually reach out to. DB trigger
// marketing.fn_gce_reject_internal_and_newsletters is the second line of defence.
const NEWSLETTER_LOCAL_RE = /^(no[-_]?reply|noreply|newsletter|marketing|notifications?|automated?|mailer[-_]daemon|postmaster|unsubscribe|do[-_]not[-_]reply|donotreply|list[-_]|bounces?|mailer|notify|alerts?|updates?)@/i;
const NEWSLETTER_SUBDOMAIN_RE = /@(mail\.|mailer\.|notifications?\.|updates?\.|news\.|newsletter\.|marketing\.|bounces?\.)/i;
const ESP_DOMAIN_RE = /@(mailchimp|constantcontact|hubspot|activecampaign|substack|beehiiv|sendgrid|sendinblue|klaviyo|mailerlite)\./i;
function isInternalOrNewsletter(email: string): boolean {
  const lo = email.toLowerCase();
  if (lo.endsWith('@thenamkhan.com')) return true;
  if (NEWSLETTER_LOCAL_RE.test(lo)) return true;
  if (NEWSLETTER_SUBDOMAIN_RE.test(lo)) return true;
  if (ESP_DOMAIN_RE.test(lo)) return true;
  return false;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parses `"Display Name" <email@x.com>, foo@bar.com` — returns [{name,email}]. */
function parseAddressList(raw: string | null | undefined): Array<{ name: string | null; email: string }> {
  if (!raw) return [];
  const out: Array<{ name: string | null; email: string }> = [];
  // Split on commas that are NOT inside quotes.
  const parts = raw.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const nameEmail = p.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    if (nameEmail) {
      const name = (nameEmail[1] || '').trim() || null;
      const email = (nameEmail[2] || '').trim().toLowerCase();
      if (email && email.includes('@')) out.push({ name, email });
      continue;
    }
    // Fallback: raw address, possibly with junk.
    const m = p.match(ADDR_RE);
    if (m) {
      for (const e of m) out.push({ name: null, email: e.toLowerCase() });
    }
  }
  return out;
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

async function fetchMessageIds(access: string, maxMessages: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined = undefined;
  while (ids.length < maxMessages) {
    const url = new URL(GMAIL_API + '/users/me/messages');
    url.searchParams.set('q', 'in:anywhere');
    url.searchParams.set('maxResults', '500');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const r = await fetch(url.toString(), { headers: { authorization: 'Bearer ' + access } });
    if (!r.ok) throw new Error('gmail_list_failed_' + r.status);
    const j = (await r.json()) as { messages?: Array<{ id: string }>; nextPageToken?: string };
    for (const m of j.messages ?? []) ids.push(m.id);
    if (!j.nextPageToken || (j.messages?.length ?? 0) === 0) break;
    pageToken = j.nextPageToken;
    if (ids.length >= maxMessages) break;
  }
  return ids.slice(0, maxMessages);
}

interface MessageMeta {
  id: string;
  from: string | null;
  to: string | null;
  cc: string | null;
  bcc: string | null;
  date: string | null;
  labelIds: string[];
}

async function fetchMessageMeta(access: string, id: string): Promise<MessageMeta | null> {
  try {
    const url = GMAIL_API + '/users/me/messages/' + id
      + '?format=metadata'
      + '&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc&metadataHeaders=Date';
    const r = await fetch(url, { headers: { authorization: 'Bearer ' + access } });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      id: string;
      labelIds?: string[];
      payload?: { headers?: Array<{ name: string; value: string }> };
    };
    const hdrs = j.payload?.headers ?? [];
    const pick = (n: string) => hdrs.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? null;
    return {
      id: j.id,
      from: pick('From'),
      to: pick('To'),
      cc: pick('Cc'),
      bcc: pick('Bcc'),
      date: pick('Date'),
      labelIds: j.labelIds ?? [],
    };
  } catch {
    return null;
  }
}

function parseDateSafe(raw: string | null): string {
  if (!raw) return new Date().toISOString();
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return new Date().toISOString();
  return new Date(t).toISOString();
}

/**
 * Core extraction loop — shared by personal + shared mailbox pipelines.
 * Caller has already resolved a fresh Gmail access token and opened a run row.
 */
async function runMessageExtraction(
  access: string,
  account: string,
  maxMessages: number,
  result: RunResult,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const accountLower = account.toLowerCase();

  const ids = await fetchMessageIds(access, maxMessages);
  const aggregates = new Map<string, ContactAggregate>();

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const metas = await Promise.all(batch.map((id) => fetchMessageMeta(access, id)));
    for (const meta of metas) {
      if (!meta) continue;
      result.messages_scanned += 1;
      const ts = parseDateSafe(meta.date);
      const fromList = parseAddressList(meta.from);
      const toList = parseAddressList(meta.to);
      const ccList = parseAddressList(meta.cc);
      const bccList = parseAddressList(meta.bcc);
      // Direction: if From matches this mailbox -> we sent it (out), else in.
      const isOutbound = fromList.some((a) => a.email === accountLower)
        || (meta.labelIds ?? []).includes('SENT');
      const parties = [...fromList, ...toList, ...ccList, ...bccList];
      for (const { name, email } of parties) {
        if (!email || email === accountLower) continue;
        // PBS 2026-07-16 — skip internal Namkhan team + newsletter/notification/ESP senders.
        // Mirrors the marketing.fn_gce_reject_internal_and_newsletters DB trigger so we avoid
        // wasted upserts and produce accurate `new_contacts` counts.
        if (isInternalOrNewsletter(email)) continue;
        const cur = aggregates.get(email);
        if (cur) {
          if (name && !cur.display_name) cur.display_name = name;
          if (ts < cur.first_seen_at) cur.first_seen_at = ts;
          if (ts > cur.last_seen_at) cur.last_seen_at = ts;
          cur.message_count += 1;
          if (isOutbound) cur.direction_out += 1; else cur.direction_in += 1;
          cur.source_accounts.add(account);
          for (const l of meta.labelIds) cur.labels_touched.add(l);
        } else {
          const agg: ContactAggregate = {
            email,
            display_name: name,
            first_seen_at: ts,
            last_seen_at: ts,
            message_count: 1,
            direction_in: isOutbound ? 0 : 1,
            direction_out: isOutbound ? 1 : 0,
            source_accounts: new Set([account]),
            labels_touched: new Set(meta.labelIds),
          };
          aggregates.set(email, agg);
        }
      }
    }
    if (i + BATCH_SIZE < ids.length) await sleep(BATCH_SLEEP_MS);
  }

  // Batch-upsert in chunks of 200 aggregates
  const rows = Array.from(aggregates.values()).map((a) => ({
    email: a.email,
    display_name: a.display_name,
    first_seen_at: a.first_seen_at,
    last_seen_at: a.last_seen_at,
    message_count: a.message_count,
    direction_mix: { in: a.direction_in, out: a.direction_out },
    source_accounts: Array.from(a.source_accounts),
    labels_touched: Array.from(a.labels_touched),
  }));

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await admin.rpc('fn_gmail_contact_upsert_batch', { p_rows: chunk });
    if (error) {
      result.status = 'failed';
      result.error = 'upsert_' + error.message;
      return;
    }
    const rowRes = Array.isArray(data) ? data[0] : data;
    result.new_contacts += Number(rowRes?.new_rows ?? 0);
    result.updated_contacts += Number(rowRes?.updated_rows ?? 0);
  }
}

async function extractForConnection(row: PersonalConnRow, maxMessages: number): Promise<RunResult> {
  const admin = getSupabaseAdmin();
  const account = row.gmail_address;

  // Start run row
  const { data: startData, error: startErr } = await admin.rpc('fn_gmail_extract_run_start', { p_account: account });
  const runId: string | null = startErr ? null : (Array.isArray(startData) ? startData[0] : startData) as string;

  const result: RunResult = {
    account_email: account,
    source: 'personal',
    run_id: runId,
    messages_scanned: 0,
    new_contacts: 0,
    updated_contacts: 0,
    status: 'succeeded',
  };

  try {
    const { access } = await refreshIfExpired(row.user_id);
    await runMessageExtraction(access, account, maxMessages, result);
  } catch (err) {
    result.status = 'failed';
    result.error = err instanceof Error ? err.message : String(err);
  }

  if (runId) {
    await admin.rpc('fn_gmail_extract_run_finish', {
      p_run_id: runId,
      p_status: result.status,
      p_msgs: result.messages_scanned,
      p_new: result.new_contacts,
      p_upd: result.updated_contacts,
      p_err: result.error ?? null,
    });
  }
  return result;
}

async function extractForSharedConnection(row: SharedConnRow, maxMessages: number): Promise<RunResult> {
  const admin = getSupabaseAdmin();
  const account = row.email;

  // Start run row
  const { data: startData, error: startErr } = await admin.rpc('fn_gmail_extract_run_start', { p_account: account });
  const runId: string | null = startErr ? null : (Array.isArray(startData) ? startData[0] : startData) as string;

  const result: RunResult = {
    account_email: account,
    source: 'shared',
    run_id: runId,
    messages_scanned: 0,
    new_contacts: 0,
    updated_contacts: 0,
    status: 'succeeded',
  };

  try {
    // Shared mailbox rows store refresh_token directly on the row; mint fresh
    // access token via Google OAuth (same as /api/cron/poll-gmail).
    const { access_token } = await refreshAccessToken(row.refresh_token);
    await runMessageExtraction(access_token, account, maxMessages, result);
  } catch (err) {
    result.status = 'failed';
    result.error = err instanceof Error ? err.message : String(err);
  }

  if (runId) {
    await admin.rpc('fn_gmail_extract_run_finish', {
      p_run_id: runId,
      p_status: result.status,
      p_msgs: result.messages_scanned,
      p_new: result.new_contacts,
      p_upd: result.updated_contacts,
      p_err: result.error ?? null,
    });
  }
  return result;
}

export async function POST(req: Request) {
  const cronOk = checkCronSecret(req);
  const adminOk = cronOk ? true : await checkAdminSession();
  if (!cronOk && !adminOk) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: ExtractBody = {};
  try { body = (await req.json()) as ExtractBody; } catch { body = {}; }
  const maxMessages = Math.max(1, Math.min(50000, Number(body.max_messages ?? 5000)));
  const includePersonal = body.include_personal !== false; // default true
  const includeShared = body.include_shared !== false;     // default true
  const accountFilter = body.account_email ? body.account_email.toLowerCase() : null;

  const admin = getSupabaseAdmin();

  // ---- Load personal connections --------------------------------------------
  let personalRows: PersonalConnRow[] = [];
  if (includePersonal) {
    let pq = admin
      .schema('marketing')
      .from('user_gmail_connections')
      .select('user_id, gmail_address, active')
      .eq('active', true);
    if (accountFilter) pq = pq.eq('gmail_address', accountFilter);
    const pRes = await pq;
    if (pRes.error) {
      return NextResponse.json({ ok: false, error: 'conn_list_personal_' + pRes.error.message }, { status: 500 });
    }
    personalRows = (pRes.data ?? []) as PersonalConnRow[];
  }

  // ---- Load shared connections ----------------------------------------------
  let sharedRows: SharedConnRow[] = [];
  if (includeShared) {
    // sales.gmail_connections has no `active` column — presence of a row = active.
    // Columns: email (pk), refresh_token, (last_synced_at, last_history_id, ...).
    let sq = admin
      .schema('sales')
      .from('gmail_connections')
      .select('email, refresh_token');
    if (accountFilter) sq = sq.eq('email', accountFilter);
    const sRes = await sq;
    if (sRes.error) {
      return NextResponse.json({ ok: false, error: 'conn_list_shared_' + sRes.error.message }, { status: 500 });
    }
    sharedRows = ((sRes.data ?? []) as SharedConnRow[]).filter((r) => !!r.refresh_token);
  }

  if (personalRows.length === 0 && sharedRows.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'no_active_connections' + (accountFilter ? '_for_' + accountFilter : ''),
    }, { status: 404 });
  }

  const runs: RunResult[] = [];
  for (const row of personalRows) {
    const r = await extractForConnection(row, maxMessages);
    runs.push(r);
  }
  for (const row of sharedRows) {
    const r = await extractForSharedConnection(row, maxMessages);
    runs.push(r);
  }

  return NextResponse.json({ ok: true, runs });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST to trigger. Header x-cron-secret or admin session required. Body: { account_email?, max_messages?, include_personal?, include_shared? }',
  });
}
