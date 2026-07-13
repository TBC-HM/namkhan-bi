// lib/userGmail.ts
// Per-user Gmail connection helpers for the top-nav dropdown + settings page.
// Distinct from lib/gmail.ts (which is the sales/inbox polling flow).
//
// This module runs SERVER-ONLY. It talks to Google's token endpoint + the
// Gmail v1 REST API on behalf of the currently-signed-in user, using the
// tokens stored in marketing.user_gmail_connections.
//
// Design contract (see feedback_supabase_only_no_disk_canonical.md):
//   - All WRITES to marketing.user_gmail_connections go through SECURITY
//     DEFINER RPCs: fn_gmail_connect_finalize / fn_gmail_persist_refresh /
//     fn_gmail_disconnect / fn_gmail_mark_inactive.
//   - Reads use fn_gmail_get_connection (returns tokens for server routes).
//   - Bridge view public.v_user_gmail_connections is used by pages/components
//     to check connection state WITHOUT tokens.

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// PBS 2026-07-13: read OAuth client from Supabase vault (rotated to unified
// namkhan-bi-vercel client). Falls back to process.env for local dev.
async function getGoogleOAuthClient(): Promise<{ clientId: string; clientSecret: string }> {
  let clientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  try {
    const admin = getSupabaseAdmin();
    const [cidRes, csecRes] = await Promise.all([
      admin.rpc('fn_get_secret', { p_name: 'GOOGLE_CLIENT_ID' }),
      admin.rpc('fn_get_secret', { p_name: 'GOOGLE_CLIENT_SECRET' }),
    ]);
    if (!cidRes.error && typeof cidRes.data === 'string' && cidRes.data.length > 20) clientId = cidRes.data;
    if (!csecRes.error && typeof csecRes.data === 'string' && csecRes.data.length > 10) clientSecret = csecRes.data;
  } catch { /* keep env fallback */ }
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID/SECRET missing in vault + env');
  return { clientId, clientSecret };
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export const USER_GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
].join(' ');

export interface CurrentAuthUser { id: string; email: string; user_metadata?: Record<string, unknown> }

export async function getCurrentAuthUser(): Promise<CurrentAuthUser | null> {
  const jar = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })), setAll: () => {} } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.id || !user?.email) return null;
  return { id: user.id, email: user.email, user_metadata: (user.user_metadata ?? {}) as Record<string, unknown> };
}

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://namkhan-bi.vercel.app';
  return base.replace(/\/$/, '') + '/api/user/gmail/callback';
}

export async function buildUserAuthUrl(state: string): Promise<string> {
  const { clientId } = await getGoogleOAuthClient();
  const u = new URL(GOOGLE_AUTH_URL);
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', USER_GMAIL_SCOPES);
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  // PBS 2026-07-13: FALSE — otherwise Google auto-re-grants gmail.metadata from prior consent,
  // which then blocks all ?q= searches (Metadata scope does not support q parameter).
  u.searchParams.set('include_granted_scopes', 'false');
  u.searchParams.set('state', state);
  return u.toString();
}

export interface TokenResp {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export async function exchangeCode(code: string): Promise<TokenResp> {
  const { clientId, clientSecret } = await getGoogleOAuthClient();
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!r.ok) throw new Error('token_exchange_failed_' + r.status + '_' + (await r.text()).slice(0, 200));
  return (await r.json()) as TokenResp;
}

export async function fetchUserinfoEmail(accessToken: string): Promise<string> {
  const r = await fetch(USERINFO_URL, { headers: { authorization: 'Bearer ' + accessToken } });
  if (!r.ok) throw new Error('userinfo_failed_' + r.status);
  const j = (await r.json()) as { email?: string };
  if (!j.email) throw new Error('userinfo_no_email');
  return j.email;
}

/**
 * Returns a valid access_token for the given user_id, refreshing via Google
 * if the stored one has < 2 minutes left. Marks the connection inactive on
 * refresh failure.
 */
export async function refreshIfExpired(userId: string): Promise<{ access: string; gmail: string }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('fn_gmail_get_connection', { p_user_id: userId });
  if (error) throw new Error('rpc_get_connection_failed_' + error.message);
  const row = Array.isArray(data) ? data[0] : (data as unknown as { access_token: string; refresh_token: string; expires_at: string; gmail_address: string; active: boolean } | null);
  if (!row || !row.active) throw new Error('not_connected');

  const expiresMs = new Date(row.expires_at).getTime();
  if (expiresMs > Date.now() + 2 * 60 * 1000) {
    return { access: row.access_token, gmail: row.gmail_address };
  }

  // Refresh
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) {
    await admin.rpc('fn_gmail_mark_inactive', { p_user_id: userId });
    throw new Error('refresh_failed_' + r.status);
  }
  const j = (await r.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) {
    await admin.rpc('fn_gmail_mark_inactive', { p_user_id: userId });
    throw new Error('refresh_no_access_token');
  }
  await admin.rpc('fn_gmail_persist_refresh', {
    p_user_id: userId,
    p_access: j.access_token,
    p_expires_seconds: j.expires_in ?? 3600,
  });
  return { access: j.access_token, gmail: row.gmail_address };
}

// --------- Gmail API wrappers -----------

export interface InboxThread {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}

export async function listInboxMessages(access: string, scope: 'unread' | 'all' = 'unread', maxResults = 200): Promise<InboxThread[]> {
  const q = scope === 'unread' ? 'in:inbox is:unread' : 'in:inbox';
  const listUrl = GMAIL_API + '/users/me/messages?maxResults=' + maxResults + '&q=' + encodeURIComponent(q);
  const listR = await fetch(listUrl, { headers: { authorization: 'Bearer ' + access } });
  if (!listR.ok) throw new Error('gmail_list_failed_' + listR.status);
  const listJ = (await listR.json()) as { messages?: Array<{ id: string; threadId: string }> };
  const items = listJ.messages ?? [];
  if (items.length === 0) return [];

  const detail = await Promise.all(items.map(async (m) => {
    const url = GMAIL_API + '/users/me/messages/' + m.id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date';
    const r = await fetch(url, { headers: { authorization: 'Bearer ' + access } });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      id: string; threadId: string; snippet?: string; labelIds?: string[];
      payload?: { headers?: Array<{ name: string; value: string }> };
    };
    const headers = j.payload?.headers ?? [];
    const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? '';
    return {
      id: j.id,
      threadId: j.threadId,
      from: h('From'),
      subject: h('Subject'),
      snippet: j.snippet ?? '',
      date: h('Date'),
      unread: (j.labelIds ?? []).includes('UNREAD'),
    } as InboxThread;
  }));
  return detail.filter((x): x is InboxThread => x !== null);
}

export async function modifyLabels(access: string, messageId: string, addLabelIds: string[] = [], removeLabelIds: string[] = []): Promise<void> {
  const url = GMAIL_API + '/users/me/messages/' + messageId + '/modify';
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' },
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
  if (!r.ok) throw new Error('gmail_modify_failed_' + r.status + '_' + (await r.text()).slice(0, 200));
}

// Base64URL encoder for Gmail raw messages (browser-safe TextEncoder path).
function base64UrlEncode(input: string): string {
  const buf = Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export interface SendParams {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body_html: string;
  body_plain?: string;
  in_reply_to?: string;
  references?: string;
  thread_id?: string;
}

export async function sendMessage(access: string, p: SendParams): Promise<{ id: string; threadId: string }> {
  const boundary = 'nmkbi_' + Math.random().toString(36).slice(2, 12);
  const plain = p.body_plain ?? p.body_html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  const headers: string[] = [
    'From: ' + p.from,
    'To: ' + p.to,
  ];
  if (p.cc) headers.push('Cc: ' + p.cc);
  if (p.bcc) headers.push('Bcc: ' + p.bcc);
  headers.push('Subject: ' + p.subject);
  if (p.in_reply_to) headers.push('In-Reply-To: ' + p.in_reply_to);
  if (p.references) headers.push('References: ' + p.references);
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
    p.body_html,
    '',
    '--' + boundary + '--',
    '',
  ].join('\r\n');

  const raw = base64UrlEncode(rfc);
  const body: Record<string, unknown> = { raw };
  if (p.thread_id) body.threadId = p.thread_id;

  const r = await fetch(GMAIL_API + '/users/me/messages/send', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('gmail_send_failed_' + r.status + '_' + (await r.text()).slice(0, 200));
  const j = (await r.json()) as { id: string; threadId: string };
  return j;
}

// ==========================================================================
// Full-screen /mail client helpers (added 2026-07-14).
// User-scoped wrappers that pull a fresh access token via refreshIfExpired().
// ==========================================================================

export interface GmailListRow {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  dateMs: number;
  snippet: string;
  unread: boolean;
  starred: boolean;
  hasAttachment: boolean;
  labelIds: string[];
}

export interface GmailMessageFull {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  dateMs: number;
  snippet: string;
  htmlBody: string;
  textBody: string;
  labelIds: string[];
  headers: Record<string, string>;
  unread: boolean;
  starred: boolean;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messagesUnread: number;
  messagesTotal: number;
}

interface GmailPayloadPart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPayloadPart[];
  headers?: Array<{ name: string; value: string }>;
}

interface GmailMessageRaw {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPayloadPart;
}

function decodeB64Url(data: string): string {
  const s = data.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  try { return Buffer.from(s + pad, 'base64').toString('utf8'); } catch { return ''; }
}

interface WalkAcc { html: string; text: string; hasAttachment: boolean }

function walkParts(part: GmailPayloadPart | undefined, acc: WalkAcc): void {
  if (!part) return;
  const mime = (part.mimeType || '').toLowerCase();
  const filename = part.filename || '';
  if (filename && filename.length > 0) acc.hasAttachment = true;
  if (mime === 'text/html' && part.body?.data && !acc.html) {
    acc.html = decodeB64Url(part.body.data);
  } else if (mime === 'text/plain' && part.body?.data && !acc.text) {
    acc.text = decodeB64Url(part.body.data);
  }
  if (part.parts && part.parts.length > 0) {
    for (const p of part.parts) walkParts(p, acc);
  }
}

function headersToMap(part: GmailPayloadPart | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const hs = part?.headers ?? [];
  for (const h of hs) out[h.name.toLowerCase()] = h.value;
  return out;
}

function parseMessage(j: GmailMessageRaw): GmailMessageFull {
  const acc: WalkAcc = { html: '', text: '', hasAttachment: false };
  walkParts(j.payload, acc);
  const hmap = headersToMap(j.payload);
  const dateStr = hmap['date'] ?? '';
  const dateMs = j.internalDate ? Number(j.internalDate) : (dateStr ? Date.parse(dateStr) || 0 : 0);
  const labelIds = j.labelIds ?? [];
  const html = acc.html || (acc.text ? '<pre style="white-space:pre-wrap;font-family:inherit;margin:0">' + escapeHtml(acc.text) + '</pre>' : '');
  return {
    id: j.id,
    threadId: j.threadId,
    subject: hmap['subject'] ?? '',
    from: hmap['from'] ?? '',
    to: hmap['to'] ?? '',
    cc: hmap['cc'] ?? '',
    date: dateStr,
    dateMs,
    snippet: j.snippet ?? '',
    htmlBody: html,
    textBody: acc.text,
    labelIds,
    headers: hmap,
    unread: labelIds.includes('UNREAD'),
    starred: labelIds.includes('STARRED'),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function gapi<T>(access: string, path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(GMAIL_API + path, {
    ...init,
    headers: {
      authorization: 'Bearer ' + access,
      'content-type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!r.ok) throw new Error('gmail_' + r.status + '_' + (await r.text()).slice(0, 200));
  return (await r.json()) as T;
}

export async function getMessage(userId: string, messageId: string): Promise<GmailMessageFull> {
  const { access } = await refreshIfExpired(userId);
  const j = await gapi<GmailMessageRaw>(access, '/users/me/messages/' + messageId + '?format=full');
  return parseMessage(j);
}

export async function getThread(userId: string, threadId: string): Promise<GmailMessageFull[]> {
  const { access } = await refreshIfExpired(userId);
  const j = await gapi<{ messages?: GmailMessageRaw[] }>(access, '/users/me/threads/' + threadId + '?format=full');
  const parsed = (j.messages ?? []).map(parseMessage);
  parsed.sort((a, b) => a.dateMs - b.dateMs);
  return parsed;
}

export async function listLabels(userId: string): Promise<GmailLabel[]> {
  const { access } = await refreshIfExpired(userId);
  const j = await gapi<{ labels?: Array<{ id: string; name: string; type: string; messagesUnread?: number; messagesTotal?: number }> }>(access, '/users/me/labels');
  const rows = (j.labels ?? []).map((l) => ({ id: l.id, name: l.name, type: (l.type === 'user' ? 'user' : 'system') as 'user' | 'system', messagesUnread: 0, messagesTotal: 0 }));
  // Fill counts where present (labels list endpoint doesn't always include counts — fetch details for unread ones only if requested).
  // For efficiency we do a small parallel batch for user + system.
  const detailed = await Promise.all(rows.map(async (r) => {
    try {
      const d = await gapi<{ messagesUnread?: number; messagesTotal?: number }>(access, '/users/me/labels/' + r.id);
      return { ...r, messagesUnread: d.messagesUnread ?? 0, messagesTotal: d.messagesTotal ?? 0 };
    } catch { return r; }
  }));
  return detailed;
}

export async function modifyLabelsForUser(userId: string, messageId: string, add: string[] = [], remove: string[] = []): Promise<void> {
  const { access } = await refreshIfExpired(userId);
  await modifyLabels(access, messageId, add, remove);
}

export async function archiveMessage(userId: string, messageId: string): Promise<void> {
  return modifyLabelsForUser(userId, messageId, [], ['INBOX']);
}

export async function trashMessage(userId: string, messageId: string): Promise<void> {
  const { access } = await refreshIfExpired(userId);
  const r = await fetch(GMAIL_API + '/users/me/messages/' + messageId + '/trash', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + access },
  });
  if (!r.ok) throw new Error('gmail_trash_failed_' + r.status);
}

export async function starMessage(userId: string, messageId: string, on: boolean): Promise<void> {
  return on
    ? modifyLabelsForUser(userId, messageId, ['STARRED'], [])
    : modifyLabelsForUser(userId, messageId, [], ['STARRED']);
}

export async function markRead(userId: string, messageId: string, read: boolean): Promise<void> {
  return read
    ? modifyLabelsForUser(userId, messageId, [], ['UNREAD'])
    : modifyLabelsForUser(userId, messageId, ['UNREAD'], []);
}

export async function replyToMessage(
  userId: string,
  threadId: string,
  inReplyToId: string,
  body: string,
  subject: string,
  to: string,
): Promise<{ id: string; threadId: string }> {
  const { access, gmail } = await refreshIfExpired(userId);
  return sendMessage(access, {
    from: gmail,
    to,
    subject,
    body_html: body,
    in_reply_to: inReplyToId,
    references: inReplyToId,
    thread_id: threadId,
  });
}

export interface ListInLabelResult {
  messages: GmailListRow[];
  nextPageToken: string | null;
}

export async function listMessagesInLabel(
  userId: string,
  labelId: string,
  q?: string,
  pageToken?: string,
  maxResults = 50,
): Promise<ListInLabelResult> {
  const { access } = await refreshIfExpired(userId);
  const params = new URLSearchParams();
  params.set('maxResults', String(maxResults));
  if (labelId) params.set('labelIds', labelId);
  if (q && q.trim()) params.set('q', q.trim());
  if (pageToken) params.set('pageToken', pageToken);
  const listJ = await gapi<{ messages?: Array<{ id: string; threadId: string }>; nextPageToken?: string }>(access, '/users/me/messages?' + params.toString());
  const items = listJ.messages ?? [];
  if (items.length === 0) return { messages: [], nextPageToken: listJ.nextPageToken ?? null };

  const detail = await Promise.all(items.map(async (m) => {
    try {
      const j = await gapi<GmailMessageRaw>(
        access,
        '/users/me/messages/' + m.id + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date',
      );
      const hmap = headersToMap(j.payload);
      const dateStr = hmap['date'] ?? '';
      const dateMs = j.internalDate ? Number(j.internalDate) : (dateStr ? Date.parse(dateStr) || 0 : 0);
      const labelIds = j.labelIds ?? [];
      // Detect attachment presence by scanning parts for a filename.
      let hasAttachment = false;
      const scan = (p: GmailPayloadPart | undefined) => {
        if (!p) return;
        if (p.filename && p.filename.length > 0) hasAttachment = true;
        (p.parts ?? []).forEach(scan);
      };
      scan(j.payload);
      return {
        id: j.id,
        threadId: j.threadId,
        subject: hmap['subject'] ?? '',
        from: hmap['from'] ?? '',
        to: hmap['to'] ?? '',
        date: dateStr,
        dateMs,
        snippet: j.snippet ?? '',
        unread: labelIds.includes('UNREAD'),
        starred: labelIds.includes('STARRED'),
        hasAttachment,
        labelIds,
      } as GmailListRow;
    } catch { return null; }
  }));

  return {
    messages: detail.filter((x): x is GmailListRow => x !== null),
    nextPageToken: listJ.nextPageToken ?? null,
  };
}
