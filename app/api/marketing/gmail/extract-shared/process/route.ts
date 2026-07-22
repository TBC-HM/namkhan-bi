// app/api/marketing/gmail/extract-shared/process/route.ts
// Newsletter Module §12.3 — 2026-07-22
//
// Async gmail extract — /process worker.
//
// Called by pg_cron every 2 min. Claims the oldest queued job from
// marketing.gmail_extract_jobs, resolves a fresh Gmail access token, walks up
// to max_messages headers, and writes results back via
// fn_gmail_extract_job_finish + the existing fn_gmail_contact_upsert_batch
// pipeline. Hard-bounded by BUDGET_MS so the request finishes under Vercel's
// 60s serverless cap comfortably.
//
// Same extraction logic as /api/marketing/contacts/extract, factored per-job
// so the outer route just walks ONE mailbox at a time.
//
// Auth: x-cron-secret header only (worker route — no session path).
//
// POST body: {} (ignored)
// Response: {
//   ok: true,
//   claimed: boolean,
//   job_id?: number,
//   account_email?: string,
//   source?: 'personal'|'shared',
//   messages_scanned?: number,
//   new_contacts?: number,
//   updated_contacts?: number,
//   status?: 'succeeded'|'failed',
//   error?: string,
// }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { refreshIfExpired } from '@/lib/userGmail';
import { refreshAccessToken } from '@/lib/gmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const BATCH_SIZE = 10;
const BATCH_SLEEP_MS = 300;
const BUDGET_MS = 50_000;
const ADDR_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

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

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function parseAddressList(raw: string | null | undefined): Array<{ name: string | null; email: string }> {
  if (!raw) return [];
  const out: Array<{ name: string | null; email: string }> = [];
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
    const m = p.match(ADDR_RE);
    if (m) for (const e of m) out.push({ name: null, email: e.toLowerCase() });
  }
  return out;
}

function checkCronSecret(req: Request): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!provided) return false;
  const envSecret = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET ?? '';
  if (!envSecret) return false;
  return provided === envSecret;
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

interface RunTotals {
  messages_scanned: number;
  new_contacts: number;
  updated_contacts: number;
}

async function walk(access: string, account: string, maxMessages: number, started: number): Promise<RunTotals & { error?: string }> {
  const admin = getSupabaseAdmin();
  const accountLower = account.toLowerCase();
  const totals: RunTotals = { messages_scanned: 0, new_contacts: 0, updated_contacts: 0 };
  const aggregates = new Map<string, ContactAggregate>();

  const ids = await fetchMessageIds(access, maxMessages);

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    if (Date.now() - started > BUDGET_MS) break;
    const batch = ids.slice(i, i + BATCH_SIZE);
    const metas = await Promise.all(batch.map((id) => fetchMessageMeta(access, id)));
    for (const meta of metas) {
      if (!meta) continue;
      totals.messages_scanned += 1;
      const ts = parseDateSafe(meta.date);
      const fromList = parseAddressList(meta.from);
      const toList = parseAddressList(meta.to);
      const ccList = parseAddressList(meta.cc);
      const bccList = parseAddressList(meta.bcc);
      const isOutbound = fromList.some((a) => a.email === accountLower)
        || (meta.labelIds ?? []).includes('SENT');
      const parties = [...fromList, ...toList, ...ccList, ...bccList];
      for (const { name, email } of parties) {
        if (!email || email === accountLower) continue;
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
          aggregates.set(email, {
            email,
            display_name: name,
            first_seen_at: ts,
            last_seen_at: ts,
            message_count: 1,
            direction_in: isOutbound ? 0 : 1,
            direction_out: isOutbound ? 1 : 0,
            source_accounts: new Set([account]),
            labels_touched: new Set(meta.labelIds),
          });
        }
      }
    }
    if (i + BATCH_SIZE < ids.length) await sleep(BATCH_SLEEP_MS);
  }

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
      return { ...totals, error: 'upsert_' + error.message };
    }
    const rowRes = Array.isArray(data) ? data[0] : data;
    totals.new_contacts += Number(rowRes?.new_rows ?? 0);
    totals.updated_contacts += Number(rowRes?.updated_rows ?? 0);
  }

  return totals;
}

export async function POST(req: Request) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const started = Date.now();
  const admin = getSupabaseAdmin();

  const { data, error } = await admin.rpc('fn_gmail_extract_job_claim_next');
  if (error) {
    return NextResponse.json({ ok: false, error: 'claim_' + error.message }, { status: 500 });
  }
  const job = Array.isArray(data) ? data[0] : data;
  if (!job || job.id == null) {
    return NextResponse.json({ ok: true, claimed: false });
  }

  const account = String(job.account_email);
  const source = String(job.source) as 'personal' | 'shared';
  const maxMessages = Number(job.max_messages ?? 2000);

  // Resolve access token by source
  let access: string;
  try {
    if (source === 'personal') {
      const { data: connData, error: connErr } = await admin
        .schema('marketing')
        .from('user_gmail_connections')
        .select('user_id')
        .eq('gmail_address', account.toLowerCase())
        .maybeSingle();
      if (connErr || !connData) throw new Error('personal_conn_lookup_failed');
      const t = await refreshIfExpired((connData as { user_id: string }).user_id);
      access = t.access;
    } else {
      const { data: connData, error: connErr } = await admin
        .schema('sales')
        .from('gmail_connections')
        .select('refresh_token')
        .eq('email', account.toLowerCase())
        .maybeSingle();
      if (connErr || !connData) throw new Error('shared_conn_lookup_failed');
      const t = await refreshAccessToken((connData as { refresh_token: string }).refresh_token);
      access = t.access_token;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.rpc('fn_gmail_extract_job_finish', {
      p_job_id: Number(job.id),
      p_status: 'failed',
      p_run_id: null,
      p_msgs: 0,
      p_new: 0,
      p_upd: 0,
      p_error: 'token_' + msg,
    });
    return NextResponse.json({
      ok: true,
      claimed: true,
      job_id: Number(job.id),
      account_email: account,
      source,
      status: 'failed',
      error: 'token_' + msg,
    });
  }

  // Start an extract run row (mirrors legacy pipeline for observability)
  const { data: runStart, error: runStartErr } = await admin.rpc('fn_gmail_extract_run_start', { p_account: account });
  const runId: string | null = runStartErr ? null : (Array.isArray(runStart) ? runStart[0] : runStart) as string;

  let error1: string | undefined;
  let totals: RunTotals = { messages_scanned: 0, new_contacts: 0, updated_contacts: 0 };
  try {
    const r = await walk(access, account, maxMessages, started);
    error1 = r.error;
    totals = { messages_scanned: r.messages_scanned, new_contacts: r.new_contacts, updated_contacts: r.updated_contacts };
  } catch (err) {
    error1 = err instanceof Error ? err.message : String(err);
  }

  const finalStatus: 'succeeded' | 'failed' = error1 ? 'failed' : 'succeeded';

  if (runId) {
    await admin.rpc('fn_gmail_extract_run_finish', {
      p_run_id: runId,
      p_status: finalStatus,
      p_msgs: totals.messages_scanned,
      p_new: totals.new_contacts,
      p_upd: totals.updated_contacts,
      p_err: error1 ?? null,
    });
  }

  await admin.rpc('fn_gmail_extract_job_finish', {
    p_job_id: Number(job.id),
    p_status: finalStatus,
    p_run_id: runId,
    p_msgs: totals.messages_scanned,
    p_new: totals.new_contacts,
    p_upd: totals.updated_contacts,
    p_error: error1 ?? null,
  });

  return NextResponse.json({
    ok: true,
    claimed: true,
    job_id: Number(job.id),
    account_email: account,
    source,
    status: finalStatus,
    messages_scanned: totals.messages_scanned,
    new_contacts: totals.new_contacts,
    updated_contacts: totals.updated_contacts,
    error: error1,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST with x-cron-secret to drain one queued gmail_extract_jobs row.',
  });
}
