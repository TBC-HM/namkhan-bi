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
  if (!row) throw new Error('no_gmail_connection');
  if (!row.active) throw new Error('connection_inactive');
  const exp = new Date(row.expires_at).getTime();
  const now = Date.now();
  const bufferMs = 2 * 60 * 1000;
  if (exp > now + bufferMs) return { access: row.access_token, gmail: row.gmail_address };
  const { clientId, clientSecret } = await getGoogleOAuthClient();
  let newAccess: string;
  let expiresIn: number;
  try {
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
      const txt = await r.text();
      if (txt.includes('invalid_grant') || txt.includes('Token has been expired or revoked')) {
        await admin.rpc('fn_gmail_mark_inactive', { p_user_id: userId });
        throw new Error('refresh_invalid_grant_marked_inactive');
      }
      throw new Error('refresh_failed_' + r.status + '_' + txt.slice(0, 200));
    }
    const j = (await r.json()) as { access_token: string; expires_in: number };
    newAccess = j.access_token;
    expiresIn = j.expires_in;
  } catch (e) {
    throw new Error('refresh_network_error_' + (e instanceof Error ? e.message : String(e)));
  }
  const { error: persistErr } = await admin.rpc('fn_gmail_persist_access_token', {
    p_user_id: userId,
    p_access_token: newAccess,
    p_expires_in: expiresIn,
  });
  if (persistErr) throw new Error('persist_access_token_failed_' + persistErr.message);
  return { access: newAccess, gmail: row.gmail_address };
}

interface GmailPayloadHeader { name: string; value: string }
interface GmailPayloadPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailPayloadHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPayloadPart[];
}
interface GmailPayload {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailPayloadHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPayloadPart[];
}
export interface GmailMessageRaw {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload: GmailPayload;
  sizeEstimate?: number;
  historyId?: string;
  internalDate?: string;
}

function headersToMap(payload: GmailPayload): Record<string, string> {
  const m: Record<string, string> = {};
  (payload.headers ?? []).forEach((h) => { m[h.name.toLowerCase()] = h.value; });
  return m;
}

function findTextBody(part: GmailPayloadPart | undefined, mime: 'text/plain' | 'text/html'): string | null {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data) {
    return Buffer.from(part.body.data, 'base64').toString('utf-8');
  }
  if (part.parts) {
    for (const sub of part.parts) {
      const found = findTextBody(sub, mime);
      if (found) return found;
    }
  }
  return null;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  date: string;
  snippet: string;
  textBody: string | null;
  htmlBody: string | null;
  unread: boolean;
  starred: boolean;
  labelIds: string[];
}

export async function getMessage(userId: string, msgId: string): Promise<GmailMessage> {
  const { access } = await refreshIfExpired(userId);
  const r = await fetch(GMAIL_API + '/users/me/messages/' + msgId + '?format=full', {
    headers: { authorization: 'Bearer ' + access },
  });
  if (!r.ok) throw new Error('fetch_message_failed_' + r.status);
  const raw = (await r.json()) as GmailMessageRaw;
  const hmap = headersToMap(raw.payload);
  const textBody = findTextBody(raw.payload, 'text/plain');
  const htmlBody = findTextBody(raw.payload, 'text/html');
  return {
    id: raw.id,
    threadId: raw.threadId,
    subject: hmap['subject'] ?? '',
    from: hmap['from'] ?? '',
    to: hmap['to'] ?? '',
    cc: hmap['cc'],
    bcc: hmap['bcc'],
    date: hmap['date'] ?? '',
    snippet: raw.snippet ?? '',
    textBody,
    htmlBody,
    unread: (raw.labelIds ?? []).includes('UNREAD'),
    starred: (raw.labelIds ?? []).includes('STARRED'),
    labelIds: raw.labelIds ?? [],
  };
}

export async function getThread(userId: string, threadId: string): Promise<GmailMessage[]> {
  const { access } = await refreshIfExpired(userId);
  const r = await fetch(GMAIL_API + '/users/me/threads/' + threadId + '?format=full', {
    headers: { authorization: 'Bearer ' + access },
  });
  if (!r.ok) throw new Error('fetch_thread_failed_' + r.status);
  const j = (await r.json()) as { id: string; messages: GmailMessageRaw[] };
  return j.messages.map((raw) => {
    const hmap = headersToMap(raw.payload);
    const textBody = findTextBody(raw.payload, 'text/plain');
    const htmlBody = findTextBody(raw.payload, 'text/html');
    return {
      id: raw.id,
      threadId: raw.threadId,
      subject: hmap['subject'] ?? '',
      from: hmap['from'] ?? '',
      to: hmap['to'] ?? '',
      cc: hmap['cc'],
      bcc: hmap['bcc'],
      date: hmap['date'] ?? '',
      snippet: raw.snippet ?? '',
      textBody,
      htmlBody,
      unread: (raw.labelIds ?? []).includes('UNREAD'),
      starred: (raw.labelIds ?? []).includes('STARRED'),
      labelIds: raw.labelIds ?? [],
    };
  });
}

function createMimeMessage(opts: {
  from: string; to: string; cc?: string; bcc?: string;
  subject: string; body_html: string; body_plain?: string;
  in_reply_to?: string; references?: string; thread_id?: string;
}): string {
  const parts: string[] = [];
  parts.push('MIME-Version: 1.0');
  parts.push('From: ' + opts.from);
  parts.push('To: ' + opts.to);
  if (opts.cc) parts.push('Cc: ' + opts.cc);
  if (opts.bcc) parts.push('Bcc: ' + opts.bcc);
  parts.push('Subject: ' + opts.subject);
  if (opts.in_reply_to) parts.push('In-Reply-To: ' + opts.in_reply_to);
  if (opts.references) parts.push('References: ' + opts.references);
  const boundary = '----=_Part_' + Math.random().toString(36).slice(2);
  parts.push('Content-Type: multipart/alternative; boundary="' + boundary + '"');
  parts.push('');
  if (opts.body_plain) {
    parts.push('--' + boundary);
    parts.push('Content-Type: text/plain; charset=UTF-8');
    parts.push('Content-Transfer-Encoding: quoted-printable');
    parts.push('');
    parts.push(opts.body_plain);
  }
  parts.push('--' + boundary);
  parts.push('Content-Type: text/html; charset=UTF-8');
  parts.push('Content-Transfer-Encoding: quoted-printable');
  parts.push('');
  parts.push(opts.body_html);
  parts.push('--' + boundary + '--');
  return parts.join('\r\n');
}

export async function sendMessage(
  accessToken: string,
  opts: {
    from: string; to: string; cc?: string; bcc?: string;
    subject: string; body_html: string; body_plain?: string;
    in_reply_to?: string; references?: string; thread_id?: string;
  },
): Promise<{ id: string; threadId: string; labelIds: string[] }> {
  const raw = createMimeMessage(opts);
  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = GMAIL_API + '/users/me/messages/send';
  const body: { raw: string; threadId?: string } = { raw: encoded };
  if (opts.thread_id) body.threadId = opts.thread_id;
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + accessToken, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('send_failed_' + r.status + '_' + (await r.text()).slice(0, 300));
  return (await r.json()) as { id: string; threadId: string; labelIds: string[] };
}

export interface ModifyLabelsOpts {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export async function modifyLabels(userId: string, msgId: string, opts: ModifyLabelsOpts): Promise<void> {
  const { access } = await refreshIfExpired(userId);
  const r = await fetch(GMAIL_API + '/users/me/messages/' + msgId + '/modify', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!r.ok) throw new Error('modify_labels_failed_' + r.status);
}

async function gapi<T>(accessToken: string, path: string): Promise<T> {
  const r = await fetch(GMAIL_API + path, { headers: { authorization: 'Bearer ' + accessToken } });
  if (!r.ok) throw new Error('gapi_' + path + '_failed_' + r.status);
  return (await r.json()) as T;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'user' | 'system';
  messageListVisibility?: string;
  labelListVisibility?: string;
  color?: { backgroundColor?: string; textColor?: string };
}

export async function getLabels(userId: string): Promise<GmailLabel[]> {
  const { access } = await refreshIfExpired(userId);
  const j = await gapi<{ labels: GmailLabel[] }>(access, '/users/me/labels');
  return j.labels ?? [];
}

export interface GmailListRow {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  deliveredTo: string;
  date: string;
  dateMs: number;
  snippet: string;
  unread: boolean;
  starred: boolean;
  hasAttachment: boolean;
  labelIds: string[];
}

export async function listMessages(
  userId: string,
  opts: { query?: string; labelIds?: string[]; maxResults?: number; pageToken?: string },
): Promise<{ messages: GmailListRow[]; nextPageToken: string | null }> {
  const { access } = await refreshIfExpired(userId);
  const params = new URLSearchParams();
  if (opts.query) params.set('q', opts.query);
  if (opts.labelIds && opts.labelIds.length > 0) opts.labelIds.forEach((lid) => params.append('labelIds', lid));
  const maxResults = opts.maxResults && opts.maxResults > 0 ? Math.min(opts.maxResults, 100) : 20;
  params.set('maxResults', String(maxResults));
  const { pageToken } = opts;
  if (pageToken) params.set('pageToken', pageToken);
  const listJ = await gapi<{ messages?: Array<{ id: string; threadId: string }>; nextPageToken?: string }>(access, '/users/me/messages?' + params.toString());
  const items = listJ.messages ?? [];
  if (items.length === 0) return { messages: [], nextPageToken: listJ.nextPageToken ?? null };

  const detail = await Promise.all(items.map(async (m) => {
    try {
      // PBS 2026-07-16 · Item 2 — add Cc + Bcc + Delivered-To metadata so the
      // Answer-expected post-filter can drop threads where user is not in To:.
      const j = await gapi<GmailMessageRaw>(
        access,
        '/users/me/messages/' + m.id + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc&metadataHeaders=Delivered-To&metadataHeaders=Subject&metadataHeaders=Date',
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
        cc: hmap['cc'] ?? '',
        bcc: hmap['bcc'] ?? '',
        deliveredTo: hmap['delivered-to'] ?? '',
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

/**
 * Check if AI features are enabled for a given mailbox.
 * Per owner decision Q3, AI calls are subject to per-mailbox policy.
 * Defaults to enabled (mailbox_id=1) if not specified.
 */
export async function checkAiPolicyEnabled(mailboxId = 1): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_mail_ai_features_enabled', { p_mailbox_id: mailboxId });
  if (error) {
    console.error('AI policy check failed:', error);
    return true; // Fail open per function default
  }
  return data === true;
}
