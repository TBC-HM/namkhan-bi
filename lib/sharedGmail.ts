// lib/sharedGmail.ts
// Filter-mode shared mailbox helpers for /sales/mails.
// PBS 2026-07-13 pivot — per-mailbox OAuth was blocked by GCP org policies.
// New model: use the CURRENT USER's personal Gmail token (from
// marketing.user_gmail_connections) to read + send for shared aliases.
//
// Reads: Gmail search with `deliveredto:<addr>` operator matches messages
//        where any recipient was that alias. We fan out one search per alias,
//        then merge + sort by internalDate desc, tagging each row with the
//        alias `mailbox_id` for badge tinting in the UI.
//
// Sends: Build RFC 2822 with `From: "Label" <alias@thenamkhan.com>` and POST
//        to users/me/messages/send. Gmail rejects the send if the alias is
//        not configured as a Send-As identity in the user's Gmail settings.
//        We surface that error verbatim.
//
// Design contract (see claude_md v3.24 §0.5):
//   - No secrets read on PostgREST — the user's token comes from
//     lib/userGmail's `refreshIfExpired(userId)` which uses SECURITY DEFINER
//     RPCs under the hood.
//   - Shared alias metadata comes from public.v_shared_mailbox_connections.
//   - Alias writes go through fn_shared_mailbox_upsert / _disconnect.

import { refreshIfExpired as refreshUserToken } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

// ---- public types ----------------------------------------------------------

export interface SharedMailbox {
  id: string;
  mailbox_address: string;
  label: string;
  badge_color: string;
  sort_order: number;
}

export interface SharedThread {
  mailbox_id: string;
  mailbox_address: string;
  label: string;
  badge_color: string;
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  dateMs: number;
  unread: boolean;
  starred: boolean;
}

export interface ListOpts {
  unreadOnly?: boolean;
  q?: string;
  limit?: number;
}

// ---- alias fetch (no secrets) ---------------------------------------------

export async function listActiveMailboxes(): Promise<SharedMailbox[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('v_shared_mailbox_connections')
    .select('id, mailbox_address, label, badge_color, sort_order, active')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw new Error('list_active_failed_' + error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    mailbox_address: r.mailbox_address as string,
    label: r.label as string,
    badge_color: (r.badge_color as string) || '#084838',
    sort_order: (r.sort_order as number) ?? 100,
  }));
}

export async function getMailboxById(mailboxId: string): Promise<SharedMailbox | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('v_shared_mailbox_connections')
    .select('id, mailbox_address, label, badge_color, sort_order, active')
    .eq('id', mailboxId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    mailbox_address: data.mailbox_address as string,
    label: data.label as string,
    badge_color: (data.badge_color as string) || '#084838',
    sort_order: (data.sort_order as number) ?? 100,
  };
}

// ---- inbox read ------------------------------------------------------------

interface GmailListItem { id: string; threadId: string }
interface GmailHeader { name: string; value: string }
interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: { headers?: GmailHeader[] };
}

function buildQuery(addr: string, opts: ListOpts): string {
  const clauses: string[] = [
    '(to:' + addr + ' OR cc:' + addr + ' OR from:' + addr + ')',
    '-label:HOD-DISMISSED',
  ];
  if (opts.unreadOnly) clauses.push('is:unread');
  if (opts.q && opts.q.trim()) clauses.push('(' + opts.q.trim() + ')');
  return clauses.join(' ');
}

async function fetchMessagesForAlias(
  access: string,
  mailbox: SharedMailbox,
  opts: ListOpts,
): Promise<SharedThread[]> {
  const q = buildQuery(mailbox.mailbox_address, opts);
  const limit = Math.max(1, Math.min(200, opts.limit ?? 200));
  const listUrl = GMAIL_API + '/users/me/messages?maxResults=' + limit + '&q=' + encodeURIComponent(q);
  const listR = await fetch(listUrl, { headers: { authorization: 'Bearer ' + access } });
  if (!listR.ok) return [];
  const listJ = (await listR.json()) as { messages?: GmailListItem[] };
  const items = listJ.messages ?? [];
  if (items.length === 0) return [];

  const details = await Promise.all(items.map(async (m) => {
    const url = GMAIL_API + '/users/me/messages/' + m.id +
      '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date';
    const r = await fetch(url, { headers: { authorization: 'Bearer ' + access } });
    if (!r.ok) return null;
    const j = (await r.json()) as GmailMessage;
    const headers = j.payload?.headers ?? [];
    const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? '';
    const dateStr = h('Date');
    const dateMs = j.internalDate ? Number(j.internalDate) : (dateStr ? Date.parse(dateStr) || 0 : 0);
    const labels = j.labelIds ?? [];
    return {
      mailbox_id: mailbox.id,
      mailbox_address: mailbox.mailbox_address,
      label: mailbox.label,
      badge_color: mailbox.badge_color,
      id: j.id,
      threadId: j.threadId,
      from: h('From'),
      to: h('To'),
      subject: h('Subject'),
      snippet: j.snippet ?? '',
      date: dateStr,
      dateMs,
      unread: labels.includes('UNREAD'),
      starred: labels.includes('STARRED'),
    } as SharedThread;
  }));

  return details.filter((x): x is SharedThread => x !== null);
}

/**
 * List the shared inbox across N aliases using ONE user token.
 * Merges results, dedupes by (mailbox_id, message id), sorts by dateMs desc.
 */
export async function listSharedInbox(
  userId: string,
  mailboxes: SharedMailbox[],
  opts: ListOpts = {},
): Promise<SharedThread[]> {
  if (mailboxes.length === 0) return [];
  const { access } = await refreshUserToken(userId);
  const perAlias = await Promise.all(mailboxes.map((m) => fetchMessagesForAlias(access, m, opts)));
  const all: SharedThread[] = [];
  const seen = new Set<string>();
  for (const list of perAlias) {
    for (const t of list) {
      const key = t.mailbox_id + ':' + t.id;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(t);
    }
  }
  all.sort((a, b) => b.dateMs - a.dateMs);
  const cap = Math.max(1, Math.min(500, opts.limit ?? 50));
  return all.slice(0, cap);
}

// ---- label ops -------------------------------------------------------------

export async function modifyLabels(
  userId: string,
  messageId: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = [],
): Promise<void> {
  const { access } = await refreshUserToken(userId);
  const url = GMAIL_API + '/users/me/messages/' + messageId + '/modify';
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' },
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
  if (!r.ok) throw new Error('gmail_modify_failed_' + r.status + '_' + (await r.text()).slice(0, 200));
}

// ---- send from alias -------------------------------------------------------

function base64UrlEncode(input: string): string {
  const buf = Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export interface SharedSendMsg {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body_html: string;
  body_plain?: string;
  thread_id?: string;
  in_reply_to?: string;
  references?: string;
}

export type SharedSendResult =
  | { ok: true; message_id: string; thread_id: string }
  | { ok: false; error: string; detail?: string };

/**
 * Send a message FROM one of the aliases using the current user's token.
 * Requires Send-As configured in Gmail for that alias — otherwise Gmail
 * returns 400 "Invalid alias" (or 403), which we surface verbatim.
 */
export async function sendFromShared(
  userId: string,
  mailboxId: string,
  msg: SharedSendMsg,
): Promise<SharedSendResult> {
  const mailbox = await getMailboxById(mailboxId);
  if (!mailbox) return { ok: false, error: 'mailbox_not_found' };

  const { access } = await refreshUserToken(userId);

  const boundary = 'nmkbi_' + Math.random().toString(36).slice(2, 12);
  const plain = msg.body_plain ?? msg.body_html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');

  const fromDisplay = '"' + mailbox.label.replace(/"/g, '') + '" <' + mailbox.mailbox_address + '>';

  const headers: string[] = [
    'From: ' + fromDisplay,
    'To: ' + msg.to,
  ];
  if (msg.cc) headers.push('Cc: ' + msg.cc);
  if (msg.bcc) headers.push('Bcc: ' + msg.bcc);
  headers.push('Subject: ' + msg.subject);
  if (msg.in_reply_to) headers.push('In-Reply-To: ' + msg.in_reply_to);
  if (msg.references) headers.push('References: ' + msg.references);
  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: multipart/alternative; boundary="' + boundary + '"');

  const rfc = [
    headers.join('\r\n'),
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    plain,
    '',
    '--' + boundary,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    msg.body_html,
    '',
    '--' + boundary + '--',
    '',
  ].join('\r\n');

  const body: Record<string, unknown> = { raw: base64UrlEncode(rfc) };
  if (msg.thread_id) body.threadId = msg.thread_id;

  const r = await fetch(GMAIL_API + '/users/me/messages/send', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 400);
    // Detect the classic Send-As not-configured error and surface it plainly.
    if (r.status === 400 && detail.toLowerCase().includes('invalid') && detail.toLowerCase().includes('alias')) {
      return { ok: false, error: 'send_as_not_configured', detail: 'Add ' + mailbox.mailbox_address + ' as a Send-As identity in your Gmail settings, then retry. Gmail said: ' + detail };
    }
    return { ok: false, error: 'gmail_send_failed_' + r.status, detail };
  }
  const j = (await r.json()) as { id: string; threadId: string };
  return { ok: true, message_id: j.id, thread_id: j.threadId };
}
