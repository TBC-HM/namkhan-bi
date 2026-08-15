// app/api/marketing/contacts/extract/route.ts
// PBS 2026-07-16 — Gmail contact extractor.
//
// Walks every ACTIVE row in BOTH
//   - marketing.user_gmail_connections  (personal per-user mailboxes)
//   - marketing.user_gmail_connections           (shared team mailboxes: book@, gm@,
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
//   include_shared?: boolean,     // default true — walk marketing.user_gmail_connections
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

async function listMessageIds(access: string, cap: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined = undefined;
  while (ids.length < cap) {
    const url = new URL(GMAIL_API + '/users/me/messages');
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

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
  internalDate?: string;
}

async function fetchMessageMeta(access: string, id: string): Promise<GmailMessage | null> {
  try {
    const url = GMAIL_API + '/users/me/messages/' + id + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc&metadataHeaders=Date';
    const r = await fetch(url, { headers: { authorization: 'Bearer ' + access } });
    if (!r.ok) return null;
    return (await r.json()) as GmailMessage;
  } catch {
    return null;
  }
}

async function batchFetchMessageMetas(access: string, ids: string[]): Promise<GmailMessage[]> {
  const out: GmailMessage[] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const promises = chunk.map((id) => fetchMessageMeta(access, id));
    const results = await Promise.all(promises);
    for (const r of results) {
      if (r) out.push(r);
    }
    if (i + BATCH_SIZE < ids.length) {
      await sleep(BATCH_SLEEP_MS);
    }
  }
  return out;
}

function extractContactsFromMessage(msg: GmailMessage, sourceAccount: string): ContactAggregate[] {
  const hdr = (name: string) =>
    (msg.payload?.headers ?? []).find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
  const fromRaw = hdr('From');
  const toRaw = hdr('To');
  const ccRaw = hdr('Cc');
  const bccRaw = hdr('Bcc');
  const dateRaw = hdr('Date');

  let receivedAt: string;
  try {
    receivedAt = dateRaw ? new Date(dateRaw).toISOString() : (msg.internalDate ? new Date(parseInt(msg.internalDate, 10)).toISOString() : new Date().toISOString());
  } catch {
    receivedAt = new Date().toISOString();
  }

  const fromList = parseAddressList(fromRaw);
  const toList = parseAddressList(toRaw);
  const ccList = parseAddressList(ccRaw);
  const bccList = parseAddressList(bccRaw);

  const me = sourceAccount.toLowerCase();
  const allRecipients = [...toList, ...ccList, ...bccList];

  const aggregates = new Map<string, ContactAggregate>();
  const upsert = (email: string, name: string | null, directionIn: number, directionOut: number) => {
    if (isInternalOrNewsletter(email)) return;
    if (!aggregates.has(email)) {
      aggregates.set(email, {
        email,
        display_name: name,
        first_seen_at: receivedAt,
        last_seen_at: receivedAt,
        message_count: 0,
        direction_in: 0,
        direction_out: 0,
        source_accounts: new Set([sourceAccount]),
        labels_touched: new Set(msg.labelIds ?? []),
      });
    }
    const agg = aggregates.get(email)!;
    agg.message_count++;
    agg.direction_in += directionIn;
    agg.direction_out += directionOut;
    if (name && !agg.display_name) agg.display_name = name;
    if (new Date(receivedAt) < new Date(agg.first_seen_at)) agg.first_seen_at = receivedAt;
    if (new Date(receivedAt) > new Date(agg.last_seen_at)) agg.last_seen_at = receivedAt;
    agg.source_accounts.add(sourceAccount);
    for (const l of msg.labelIds ?? []) agg.labels_touched.add(l);
  };

  const iSentThis = fromList.some((f) => f.email === me);
  if (iSentThis) {
    for (const r of allRecipients) {
      upsert(r.email, r.name, 0, 1);
    }
  } else {
    for (const f of fromList) {
      upsert(f.email, f.name, 1, 0);
    }
  }

  return Array.from(aggregates.values());
}

async function runMessageExtraction(
  admin: any,
  sourceKind: SourceKind,
  accountEmail: string,
  access: string,
  maxMessages: number,
): Promise<Omit<RunResult, 'status' | 'error'>> {
  const startedAt = new Date().toISOString();
  const { data: runRow, error: runInsErr } = await admin.schema('marketing').from('gmail_contact_extraction_runs').insert({
    account_email: accountEmail,
    source: sourceKind,
    started_at: startedAt,
    status: 'running',
  }).select('id').single();

  if (runInsErr || !runRow) {
    return {
      account_email: accountEmail,
      source: sourceKind,
      run_id: null,
      messages_scanned: 0,
      new_contacts: 0,
      updated_contacts: 0,
    };
  }
  const runId = runRow.id;

  let ids: string[];
  try {
    ids = await listMessageIds(access, maxMessages);
  } catch (e: any) {
    await admin.schema('marketing').from('gmail_contact_extraction_runs').update({ status: 'failed', error_message: 'list_' + e.message, finished_at: new Date().toISOString() }).eq('id', runId);
    throw e;
  }

  if (ids.length === 0) {
    await admin.schema('marketing').from('gmail_contact_extraction_runs').update({ status: 'succeeded', messages_scanned: 0, finished_at: new Date().toISOString() }).eq('id', runId);
    return {
      account_email: accountEmail,
      source: sourceKind,
      run_id: runId,
      messages_scanned: 0,
      new_contacts: 0,
      updated_contacts: 0,
    };
  }

  let messages: GmailMessage[];
  try {
    messages = await batchFetchMessageMetas(access, ids);
  } catch (e: any) {
    await admin.schema('marketing').from('gmail_contact_extraction_runs').update({ status: 'failed', error_message: 'fetch_' + e.message, finished_at: new Date().toISOString() }).eq('id', runId);
    throw e;
  }

  const contactMap = new Map<string, ContactAggregate>();
  for (const m of messages) {
    const contacts = extractContactsFromMessage(m, accountEmail);
    for (const c of contacts) {
      if (!contactMap.has(c.email)) {
        contactMap.set(c.email, c);
      } else {
        const existing = contactMap.get(c.email)!;
        existing.message_count += c.message_count;
        existing.direction_in += c.direction_in;
        existing.direction_out += c.direction_out;
        if (new Date(c.first_seen_at) < new Date(existing.first_seen_at)) existing.first_seen_at = c.first_seen_at;
        if (new Date(c.last_seen_at) > new Date(existing.last_seen_at)) existing.last_seen_at = c.last_seen_at;
        if (c.display_name && !existing.display_name) existing.display_name = c.display_name;
        for (const a of c.source_accounts) existing.source_accounts.add(a);
        for (const l of c.labels_touched) existing.labels_touched.add(l);
      }
    }
  }

  const rows = Array.from(contactMap.values()).map((c) => ({
    email: c.email,
    display_name: c.display_name,
    first_seen_at: c.first_seen_at,
    last_seen_at: c.last_seen_at,
    message_count: c.message_count,
    direction_in: c.direction_in,
    direction_out: c.direction_out,
    source_accounts: Array.from(c.source_accounts),
    labels_touched: Array.from(c.labels_touched),
  }));

  let newContacts = 0;
  let updatedContacts = 0;

  for (const r of rows) {
    const { data: existingRow } = await admin.schema('marketing').from('gmail_contacts_extracted').select('email, message_count').eq('email', r.email).maybeSingle();
    const isNew = !existingRow;
    if (isNew) newContacts++;
    else updatedContacts++;

    const upsertPayload: any = {
      email: r.email,
      display_name: r.display_name,
      first_seen_at: r.first_seen_at,
      last_seen_at: r.last_seen_at,
      message_count: r.message_count,
      direction_in: r.direction_in,
      direction_out: r.direction_out,
      source_accounts: r.source_accounts,
      labels_touched: r.labels_touched,
    };

    await admin.schema('marketing').from('gmail_contacts_extracted').upsert(upsertPayload, { onConflict: 'email', ignoreDuplicates: false });
  }

  await admin.schema('marketing').from('gmail_contact_extraction_runs').update({ status: 'succeeded', messages_scanned: messages.length, new_contacts: newContacts, updated_contacts: updatedContacts, finished_at: new Date().toISOString() }).eq('id', runId);

  return {
    account_email: accountEmail,
    source: sourceKind,
    run_id: runId,
    messages_scanned: messages.length,
    new_contacts: newContacts,
    updated_contacts: updatedContacts,
  };
}

export async function POST(req: Request) {
  const isCron = checkCronSecret(req);
  const isAdmin = await checkAdminSession();
  if (!isCron && !isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const body: ExtractBody = await req.json().catch(() => ({}));
  const accountFilter = body.account_email ?? null;
  const maxMessages = body.max_messages ?? (isCron ? 2000 : 5000);
  const includePersonal = body.include_personal ?? true;
  const includeShared = body.include_shared ?? true;

  const admin = getSupabaseAdmin();
  const results: RunResult[] = [];

  if (includePersonal) {
    let pq = admin.schema('marketing').from('user_gmail_connections').select('user_id, gmail_address, active').eq('active', true);
    if (accountFilter) pq = pq.eq('gmail_address', accountFilter);
    const pRes = await pq;
    if (pRes.error) {
      return NextResponse.json({ ok: false, error: 'conn_list_personal_' + pRes.error.message }, { status: 500 });
    }
    const personalAccounts = (pRes.data ?? []) as PersonalConnRow[];
    for (const p of personalAccounts) {
      try {
        const { access: access_token } = await refreshIfExpired(p.user_id);
        const r = await runMessageExtraction(admin, 'personal', p.gmail_address, access_token, maxMessages);
        results.push({ ...r, status: 'succeeded' });
      } catch (e: any) {
        results.push({ account_email: p.gmail_address, source: 'personal', run_id: null, messages_scanned: 0, new_contacts: 0, updated_contacts: 0, status: 'failed', error: e.message });
      }
    }
  }

  if (includeShared) {
    // marketing.user_gmail_connections has no `active` column — presence of a row = active.
    // Columns: email (pk), refresh_token, (last_synced_at, last_history_id, ...).
    let sq = admin
      .schema('marketing')
      .from('user_gmail_connections')
      .select('email, refresh_token');
    if (accountFilter) sq = sq.eq('email', accountFilter);
    const sRes = await sq;
    if (sRes.error) {
      return NextResponse.json({ ok: false, error: 'conn_list_shared_' + sRes.error.message }, { status: 500 });
    }
    const sharedAccounts = (sRes.data ?? []) as SharedConnRow[];
    for (const s of sharedAccounts) {
      try {
        const t = await refreshAccessToken(s.refresh_token);
        const r = await runMessageExtraction(admin, 'shared', s.email, t.access_token, maxMessages);
        results.push({ ...r, status: 'succeeded' });
      } catch (e: any) {
        results.push({ account_email: s.email, source: 'shared', run_id: null, messages_scanned: 0, new_contacts: 0, updated_contacts: 0, status: 'failed', error: e.message });
      }
    }
  }

  return NextResponse.json({ ok: true, runs: results });
}
