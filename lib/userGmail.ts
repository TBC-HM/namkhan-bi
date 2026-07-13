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
  'https://www.googleapis.com/auth/gmail.metadata',
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
  u.searchParams.set('include_granted_scopes', 'true');
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

export async function listInboxMessages(access: string, scope: 'unread' | 'all' = 'unread', maxResults = 15): Promise<InboxThread[]> {
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
