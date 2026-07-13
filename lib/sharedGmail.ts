// lib/sharedGmail.ts
// Shared Google Workspace mailbox helpers for the Sales · Mails inbox.
// Sister module to lib/userGmail.ts (per-user, top-nav dropdown). This one
// powers the /sales/mails unified inbox across book@thenamkhan.com,
// gm@thenamkhan.com, reservations@thenamkhan.com, and any other shared
// mailbox PBS connects.
//
// Design contract:
//   - All WRITES go through SECURITY DEFINER RPCs in the public schema
//     (fn_shared_mailbox_*). PostgREST is public-schema-only per claude_md
//     v3.1 §0.5.
//   - Reads with secrets use fn_shared_mailbox_get_connection /
//     fn_shared_mailbox_list_active (service_role only).
//   - Reads without secrets go through the bridge view
//     public.v_shared_mailbox_connections.
//   - Only *@thenamkhan.com addresses can be connected — domain-guarded in
//     the RPC.

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// Broader scopes than userGmail — shared mailboxes need read + send + modify.
export const SHARED_MAILBOX_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
].join(' ');

// ---------- auth-user helper (who's connecting the mailbox) ----------
export interface CurrentAuthUser { id: string; email: string }

export async function getCurrentAuthUser(): Promise<CurrentAuthUser | null> {
  const jar = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })), setAll: () => {} } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.id || !user?.email) return null;
  return { id: user.id, email: user.email };
}

// ---------- OAuth URL builder ----------

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://namkhan-bi.vercel.app';
  return base.replace(/\/$/, '') + '/api/sales/mails/callback';
}

export function buildSharedAuthUrl(state: string, loginHint?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID env var missing');
  const u = new URL(GOOGLE_AUTH_URL);
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', SHARED_MAILBOX_SCOPES);
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('include_granted_scopes', 'true');
  if (loginHint) u.searchParams.set('login_hint', loginHint);
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
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
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

// ---------- state signing (very light — HMAC-SHA256 with app secret) ----------
// We use a compact hand-rolled signed token instead of pulling in a JWT dep.
// Payload is base64url-json, sig is HMAC-SHA256 with STATE_SECRET (or NEXT_PUBLIC_SUPABASE_ANON_KEY as fallback).

import crypto from 'node:crypto';

function stateSecret(): string {
  return process.env.STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'namkhan-mails-fallback';
}

function b64url(s: Buffer | string): string {
  const b = typeof s === 'string' ? Buffer.from(s, 'utf8') : s;
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8');
}

export interface StatePayload {
  mailbox: string;
  label: string;
  connected_by: string | null;
  ts: number;
}

export function signState(p: StatePayload): string {
  const payload = b64url(JSON.stringify(p));
  const sig = b64url(crypto.createHmac('sha256', stateSecret()).update(payload).digest());
  return payload + '.' + sig;
}

export function verifyState(token: string): StatePayload | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expect = b64url(crypto.createHmac('sha256', stateSecret()).update(payload).digest());
  if (expect !== sig) return null;
  try {
    const p = JSON.parse(b64urlDecode(payload)) as StatePayload;
    // 30-min TTL
    if (Date.now() - p.ts > 30 * 60 * 1000) return null;
    return p;
  } catch { return null; }
}

// ---------- token refresh + Gmail API wrappers ----------

interface MailboxRow {
  id: string;
  mailbox_address: string;
  label: string;
  badge_color: string;
  access_token: string;
  refresh_token: string;
  scope: string;
  expires_at: string;
  active?: boolean;
  sort_order?: number;
}

/**
 * Returns { access, mailbox } for the given mailbox_id, refreshing the token
 * via Google if needed. Marks the connection inactive on refresh failure.
 */
export async function refreshIfExpired(mailboxId: string): Promise<{ access: string; mailbox: MailboxRow }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('fn_shared_mailbox_get_connection', { p_mailbox_id: mailboxId });
  if (error) throw new Error('rpc_get_connection_failed_' + error.message);
  const rows = (data ?? []) as MailboxRow[];
  const row = rows[0];
  if (!row || row.active === false) throw new Error('not_connected');

  const expiresMs = new Date(row.expires_at).getTime();
  if (expiresMs > Date.now() + 2 * 60 * 1000) {
    return { access: row.access_token, mailbox: row };
  }

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
    await admin.rpc('fn_shared_mailbox_mark_inactive', { p_mailbox_id: mailboxId });
    throw new Error('refresh_failed_' + r.status);
  }
  const j = (await r.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) {
    await admin.rpc('fn_shared_mailbox_mark_inactive', { p_mailbox_id: mailboxId });
    throw new Error('refresh_no_access_token');
  }
  await admin.rpc('fn_shared_mailbox_persist_refresh', {
    p_mailbox_id: mailboxId,
    p_access: j.access_token,
    p_expires_seconds: j.expires_in ?? 3600,
  });
  return { access: j.access_token, mailbox: { ...row, access_token: j.access_token } };
}

// ---------- Inbox listing ----------

export interface InboxThread {
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
  date: string;              // header value as returned by Gmail
  dateMs: number;            // parsed epoch ms for sorting
  unread: boolean;
  starred: boolean;
}

export async function listInboxForMailbox(
  access: string,
  mailbox: Pick<MailboxRow, 'id' | 'mailbox_address' | 'label' | 'badge_color'>,
  opts: { unread?: boolean; q?: string; limit?: number },
): Promise<InboxThread[]> {
  const parts: string[] = [];
  if (opts.unread) parts.push('is:unread');
  parts.push('in:inbox');
  if (opts.q && opts.q.trim()) parts.push(opts.q.trim());
  const gmailQ = parts.join(' ');
  const limit = Math.max(1, Math.min(500, opts.limit ?? 50));
  const listUrl = GMAIL_API + '/users/me/messages?maxResults=' + limit + '&q=' + encodeURIComponent(gmailQ);
  const listR = await fetch(listUrl, { headers: { authorization: 'Bearer ' + access } });
  if (!listR.ok) throw new Error('gmail_list_failed_' + listR.status);
  const listJ = (await listR.json()) as { messages?: Array<{ id: string; threadId: string }> };
  const items = listJ.messages ?? [];
  if (items.length === 0) return [];

  // Fetch each message metadata in parallel with a bounded concurrency of 10.
  async function fetchMeta(id: string): Promise<InboxThread | null> {
    const url = GMAIL_API + '/users/me/messages/' + id +
      '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=To';
    const r = await fetch(url, { headers: { authorization: 'Bearer ' + access } });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      id: string; threadId: string; snippet?: string; labelIds?: string[];
      payload?: { headers?: Array<{ name: string; value: string }> };
    };
    const headers = j.payload?.headers ?? [];
    const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? '';
    const dateStr = h('Date');
    const dateMs = dateStr ? new Date(dateStr).getTime() : 0;
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
      dateMs: Number.isFinite(dateMs) ? dateMs : 0,
      unread: labels.includes('UNREAD'),
      starred: labels.includes('STARRED'),
    };
  }

  const results: InboxThread[] = [];
  const CONC = 10;
  for (let i = 0; i < items.length; i += CONC) {
    const chunk = items.slice(i, i + CONC);
    const batch = await Promise.all(chunk.map((m) => fetchMeta(m.id)));
    for (const t of batch) if (t) results.push(t);
  }
  return results;
}

/**
 * Aggregates threads across every active shared mailbox (or a specific one)
 * and returns them sorted by date desc.
 */
export async function listInboxAcross(
  opts: { mailbox_id?: string; unread?: boolean; q?: string; limit?: number },
): Promise<InboxThread[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('fn_shared_mailbox_list_active');
  if (error) throw new Error('rpc_list_active_failed_' + error.message);
  let rows = (data ?? []) as MailboxRow[];
  if (opts.mailbox_id) rows = rows.filter((r) => r.id === opts.mailbox_id);
  if (rows.length === 0) return [];

  const perLimit = opts.limit ?? 50;

  const perMailbox = await Promise.all(rows.map(async (row) => {
    try {
      const { access } = await refreshIfExpired(row.id);
      const items = await listInboxForMailbox(access, row, {
        unread: opts.unread,
        q: opts.q,
        limit: perLimit,
      });
      return items;
    } catch (e) {
      // Silent-drop a single mailbox rather than fail the whole request.
      // The caller can inspect connection.active via the bridge view.
      console.error('[shared-mailbox] inbox_failed', row.mailbox_address, e);
      return [] as InboxThread[];
    }
  }));

  const merged = perMailbox.flat();
  merged.sort((a, b) => b.dateMs - a.dateMs);
  return merged;
}

// ---------- Actions (modify, send) ----------

export async function modifyLabels(access: string, messageId: string, addLabelIds: string[] = [], removeLabelIds: string[] = []): Promise<void> {
  const url = GMAIL_API + '/users/me/messages/' + messageId + '/modify';
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' },
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
  if (!r.ok) throw new Error('gmail_modify_failed_' + r.status + '_' + (await r.text()).slice(0, 200));
}

function base64UrlEncode(input: string): string {
  const buf = Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export interface SendParams {
  from: string;        // MUST be the shared mailbox address
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
  return (await r.json()) as { id: string; threadId: string };
}

// ---------- Public summary type (for pages) ----------

export interface SharedMailboxSummary {
  id: string;
  mailbox_address: string;
  label: string;
  badge_color: string;
  sort_order: number;
  active: boolean;
}
