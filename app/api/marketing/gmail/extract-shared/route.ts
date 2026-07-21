// app/api/marketing/gmail/extract-shared/route.ts
// PBS 2026-07-21 — Gmail Domain-Wide Delegation contact extractor.
//
// Walks any @thenamkhan.com mailbox via service-account impersonation (no
// per-user OAuth, no shared refresh tokens on file). Same pipeline shape as
// /api/marketing/contacts/extract but reads the Workspace mailboxes directly
// via impersonateGmail() from lib/gmail.ts.
//
// Auth: shared bearer secret (Authorization: Bearer <CRON_SHARED_SECRET>) OR
// legacy `x-cron-secret` header. Not publicly callable.
//
// POST body:
//   {
//     mailboxes?: string[],   // default = 9 canonical @thenamkhan.com mailboxes
//     max_messages?: number,  // per mailbox, default 5000
//   }
//
// Response:
//   {
//     ok, mailboxes_walked, total_msgs, new_contacts, updated_contacts,
//     runs: [{ mailbox, messages_scanned, new_contacts, updated_contacts, status, error? }],
//     ticket_id
//   }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { impersonateGmail } from '@/lib/gmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min hard cap

const BATCH_SIZE = 10;
const BATCH_SLEEP_MS = 500;
const ADDR_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

// Default set — 9 canonical shared mailboxes per PBS spec.
const DEFAULT_MAILBOXES = [
  'book@thenamkhan.com',
  'reservations@thenamkhan.com',
  'gm@thenamkhan.com',
  'pann@thenamkhan.com',
  'wm@thenamkhan.com',
  'pb@thenamkhan.com',
  'rm@thenamkhan.com',
  'xl@thenamkhan.com',
  'rom@thenamkhan.com',
];

interface ExtractBody {
  mailboxes?: string[];
  max_messages?: number;
}

interface RunResult {
  mailbox: string;
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

// Mirror of the filter in /api/marketing/contacts/extract/route.ts.
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

function parseDateSafe(raw: string | null): string {
  if (!raw) return new Date().toISOString();
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return new Date().toISOString();
  return new Date(t).toISOString();
}

function checkAuth(req: Request): boolean {
  const envSecret = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET ?? '';
  if (!envSecret) return false;
  // Prefer Authorization: Bearer <secret>, fall back to x-cron-secret.
  const auth = req.headers.get('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const tok = auth.slice(7).trim();
    if (tok && tok === envSecret) return true;
  }
  const xh = req.headers.get('x-cron-secret') ?? '';
  return !!xh && xh === envSecret;
}

async function extractMailbox(mailbox: string, maxMessages: number): Promise<RunResult> {
  const admin = getSupabaseAdmin();
  const accountLower = mailbox.toLowerCase();

  const { data: startData, error: startErr } = await admin.rpc('fn_gmail_extract_run_start', { p_account: mailbox });
  const runId: string | null = startErr ? null : ((Array.isArray(startData) ? startData[0] : startData) as string | null);

  const result: RunResult = {
    mailbox,
    run_id: runId,
    messages_scanned: 0,
    new_contacts: 0,
    updated_contacts: 0,
    status: 'succeeded',
  };

  try {
    const client = await impersonateGmail(mailbox);

    // Page through message IDs up to the cap.
    // NOTE: Google's DWD metadata scope rejects `q=` filters ("Metadata scope
    // does not support 'q' parameter", 403). Even though we request both
    // gmail.readonly + gmail.metadata in the JWT, the effective session
    // capability is metadata-only for many Workspace mailboxes. Omitting the
    // `q` returns messages from all labels including SENT.
    const ids: string[] = [];
    let pageToken: string | undefined = undefined;
    while (ids.length < maxMessages) {
      const page = await client.listMessageIds({ maxResults: 500, pageToken });
      for (const m of page.messages ?? []) ids.push(m.id);
      if (!page.nextPageToken || (page.messages?.length ?? 0) === 0) break;
      pageToken = page.nextPageToken;
    }
    const capped = ids.slice(0, maxMessages);

    const aggregates = new Map<string, ContactAggregate>();

    for (let i = 0; i < capped.length; i += BATCH_SIZE) {
      const batch = capped.slice(i, i + BATCH_SIZE);
      const metas = await Promise.all(batch.map((id) => client.getMessageMetadata(id)));
      for (const meta of metas) {
        if (!meta) continue;
        result.messages_scanned += 1;
        const hdrs = meta.payload?.headers ?? [];
        const pick = (n: string) => hdrs.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? null;
        const from = pick('From');
        const to = pick('To');
        const cc = pick('Cc');
        const bcc = pick('Bcc');
        const date = pick('Date');
        const ts = parseDateSafe(date);
        const fromList = parseAddressList(from);
        const toList = parseAddressList(to);
        const ccList = parseAddressList(cc);
        const bccList = parseAddressList(bcc);
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
            cur.source_accounts.add(mailbox);
            for (const l of meta.labelIds ?? []) cur.labels_touched.add(l);
          } else {
            aggregates.set(email, {
              email,
              display_name: name,
              first_seen_at: ts,
              last_seen_at: ts,
              message_count: 1,
              direction_in: isOutbound ? 0 : 1,
              direction_out: isOutbound ? 1 : 0,
              source_accounts: new Set([mailbox]),
              labels_touched: new Set(meta.labelIds ?? []),
            });
          }
        }
      }
      if (i + BATCH_SIZE < capped.length) await sleep(BATCH_SLEEP_MS);
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
        result.status = 'failed';
        result.error = 'upsert_' + error.message;
        break;
      }
      const rowRes = Array.isArray(data) ? data[0] : data;
      result.new_contacts += Number(rowRes?.new_rows ?? 0);
      result.updated_contacts += Number(rowRes?.updated_rows ?? 0);
    }
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
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: ExtractBody = {};
  try { body = (await req.json()) as ExtractBody; } catch { body = {}; }
  const mailboxes = (Array.isArray(body.mailboxes) && body.mailboxes.length > 0
    ? body.mailboxes
    : DEFAULT_MAILBOXES).map((m) => m.trim()).filter(Boolean);
  const maxMessages = Math.max(1, Math.min(50000, Number(body.max_messages ?? 5000)));

  const admin = getSupabaseAdmin();
  const startedAt = new Date().toISOString();

  const runs: RunResult[] = [];
  for (const mb of mailboxes) {
    const r = await extractMailbox(mb, maxMessages);
    runs.push(r);
  }

  const totalMsgs = runs.reduce((s, r) => s + r.messages_scanned, 0);
  const totalNew = runs.reduce((s, r) => s + r.new_contacts, 0);
  const totalUpd = runs.reduce((s, r) => s + r.updated_contacts, 0);
  const failed = runs.filter((r) => r.status === 'failed');

  // Cockpit audit ticket — mirrors the existing gmail-extract logging pattern.
  let ticketId: string | null = null;
  try {
    const { data: t, error: tErr } = await admin
      .from('cockpit_tickets')
      .insert({
        source: 'gmail_extract_shared',
        arm: 'marketing',
        intent: 'extract_contacts_dwd',
        status: failed.length === runs.length ? 'failed' : (failed.length > 0 ? 'partial' : 'succeeded'),
        email_subject: `DWD extract · ${mailboxes.length} mailbox(es) · ${totalMsgs} msgs · +${totalNew} new`,
        parsed_summary: JSON.stringify({ mailboxes, total_msgs: totalMsgs, new_contacts: totalNew, failed: failed.map((f) => f.mailbox) }),
        metadata: {
          mailboxes,
          total_msgs: totalMsgs,
          new_contacts: totalNew,
          updated_contacts: totalUpd,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          runs: runs.map((r) => ({ mailbox: r.mailbox, status: r.status, msgs: r.messages_scanned, new: r.new_contacts, upd: r.updated_contacts, error: r.error ?? null })),
        },
      })
      .select('id')
      .single();
    if (!tErr && t) ticketId = String((t as { id: string | number }).id);
  } catch { /* audit is best-effort */ }

  return NextResponse.json({
    ok: failed.length < runs.length,
    mailboxes_walked: runs.length,
    total_msgs: totalMsgs,
    new_contacts: totalNew,
    updated_contacts: totalUpd,
    runs,
    ticket_id: ticketId,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST with Authorization: Bearer <CRON_SHARED_SECRET>. Body: { mailboxes?: string[], max_messages?: number }. Default mailboxes = 9 canonical @thenamkhan.com addresses.',
    default_mailboxes: DEFAULT_MAILBOXES,
  });
}
