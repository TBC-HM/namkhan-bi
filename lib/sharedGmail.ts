// lib/sharedGmail.ts
// Filter-mode shared mailbox helpers for /sales/mails + HoD mail panels.
//
// PBS 2026-07-14 (source-of-truth pivot):
//   /sales/mails + all HoD panels now read + send via a SINGLE shared
//   Gmail token owned by the account stored in
//   marketing.shared_mailbox_config.source_email (default pb@thenamkhan.com).
//   Personal /mail + top-nav dropdown continue to use per-user tokens
//   (lib/userGmail).
//
// Reads: Gmail search with `deliveredto:<addr>` operator matches messages
//        where any recipient was that alias. We fan out one search per alias,
//        merge + sort by internalDate desc, tag each row with mailbox_id.
//
// Sends: Build RFC 2822 with `From: "Label" <alias@thenamkhan.com>` and POST
//        to users/me/messages/send using the SHARED user's token. Alias must
//        be configured as Send-As under pb@thenamkhan.com's Gmail settings.
//
// Design contract (see claude_md v3.24 §0.5):
//   - No secrets read on PostgREST — the shared user's token is fetched via
//     the same SECURITY DEFINER RPCs (fn_gmail_get_connection) that back
//     lib/userGmail's refreshIfExpired().
//   - Shared source is public.fn_shared_mailbox_source() → resolved to a
//     user_id via marketing.user_gmail_connections in getSharedUserId().

import { refreshIfExpired as refreshUserToken } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

// ---- shared-source resolution ---------------------------------------------

let _cachedSharedUserId: { at: number; source: string; user_id: string } | null = null;
const SHARED_TTL_MS = 60_000; // re-resolve every 60s in case source_email is swapped

/**
 * Resolve the shared mailbox source (source_email) + owning auth user_id.
 * Reads from public.v_shared_mailbox_source, joins to
 * marketing.user_gmail_connections to find the active auth user_id whose
 * gmail_address matches. Throws with a stable error code if not connected.
 */
export async function getSharedUserId(): Promise<{ user_id: string; source_email: string }> {
  const now = Date.now();
  if (_cachedSharedUserId && now - _cachedSharedUserId.at < SHARED_TTL_MS) {
    return { user_id: _cachedSharedUserId.user_id, source_email: _cachedSharedUserId.source };
  }
  const admin = getSupabaseAdmin();
  const { data: srcRow, error: srcErr } = await admin
    .from('v_shared_mailbox_source')
    .select('source_email')
    .eq('id', 1)
    .maybeSingle();
  if (srcErr || !srcRow?.source_email) throw new Error('shared_source_missing');
  const source = String((srcRow as { source_email: string }).source_email).toLowerCase();

  const { data: connRow, error: connErr } = await admin
    .from('v_user_gmail_connections')
    .select('user_id, gmail_address, active')
    .eq('active', true)
    .ilike('gmail_address', source)
    .maybeSingle();
  if (connErr || !connRow) throw new Error('shared_source_not_connected_' + source);
  const userId = String((connRow as { user_id: string }).user_id);
  _cachedSharedUserId = { at: now, source, user_id: userId };
  return { user_id: userId, source_email: source };
}

/**
 * Return a fresh access token for the SHARED mailbox account.
 * Refreshes via the same helper used for personal tokens.
 * Marked clearly as SHARED — do NOT use for /mail or top-nav dropdown.
 */
export async function getSharedGmailAccessToken(): Promise<{ access: string; gmail: string }> {
  const { user_id } = await getSharedUserId();
  return refreshUserToken(user_id);
}

// ---- audit log (fire-and-forget) ------------------------------------------

export interface LogArgs {
  user_id: string;
  user_email: string;
  action: 'view' | 'reply_sent' | 'dismiss' | 'convert_to_lead' | 'star' | 'mark_read';
  thread_id?: string | null;
  mailbox_alias?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Fire-and-forget audit write. Never throws, never blocks. */
export function logSharedMailboxEvent(args: LogArgs): void {
  const admin = getSupabaseAdmin();
  admin.rpc('fn_log_shared_mailbox_event', {
    p_user_id: args.user_id,
    p_user_email: args.user_email,
    p_action: args.action,
    p_thread_id: args.thread_id ?? null,
    p_mailbox_alias: args.mailbox_alias ?? null,
    p_metadata: (args.metadata as unknown as object) ?? null,
  }).then(({ error }) => {
    if (error) console.error('[shared_mailbox_event log failed]', args.action, error.message);
  }).catch((e) => console.error('[shared_mailbox_event log threw]', args.action, e));
}

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
  const clauses: string[] = ['deliveredto:' + addr];
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
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
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
 * List the shared inbox across N aliases using the SHARED mailbox token.
 * Second arg kept for backwards-compat (was userId in legacy per-user model)
 * but is now IGNORED — routing is fixed to the shared source. Merges,
 * dedupes by (mailbox_id, message id), sorts by dateMs desc.
 */
export async function listSharedInbox(
  _legacyUserId: string,
  mailboxes: SharedMailbox[],
  opts: ListOpts = {},
): Promise<SharedThread[]> {
  if (mailboxes.length === 0) return [];
  const { access } = await getSharedGmailAccessToken();
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

// ---- label ops (SHARED token) ---------------------------------------------

/**
 * Modify labels on a message in the SHARED mailbox.
 * Signature kept `(legacyUserId, messageId, add, remove)` for back-compat with
 * existing callers — first arg is IGNORED (route may pass user.id).
 */
export async function modifyLabels(
  _legacyUserId: string,
  messageId: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = [],
): Promise<void> {
  const { access } = await getSharedGmailAccessToken();
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
 * Send a message FROM one of the aliases using the SHARED mailbox token.
 * Requires the alias to be configured as Send-As under the shared account.
 * First arg (legacyUserId) is retained for signature-compat but IGNORED.
 */
export async function sendFromShared(
  _legacyUserId: string,
  mailboxId: string,
  msg: SharedSendMsg,
): Promise<SharedSendResult> {
  const mailbox = await getMailboxById(mailboxId);
  if (!mailbox) return { ok: false, error: 'mailbox_not_found' };

  const { access } = await getSharedGmailAccessToken();

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
    if (r.status === 400 && detail.toLowerCase().includes('invalid') && detail.toLowerCase().includes('alias')) {
      return { ok: false, error: 'send_as_not_configured', detail: 'Add ' + mailbox.mailbox_address + ' as a Send-As identity under the shared Gmail account, then retry. Gmail said: ' + detail };
    }
    return { ok: false, error: 'gmail_send_failed_' + r.status, detail };
  }
  const j = (await r.json()) as { id: string; threadId: string };
  return { ok: true, message_id: j.id, thread_id: j.threadId };
}
