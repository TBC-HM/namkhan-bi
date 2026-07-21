// lib/gmail.ts
// Gmail OAuth + polling helpers. Self-contained — no Make.com dependency.
//
// Flow:
//  1. /api/auth/gmail/start   → redirects to Google
//  2. /api/auth/gmail/callback → exchanges code for refresh_token, stores in
//     sales.gmail_connections, redirects back to admin
//  3. /api/cron/poll-gmail    → for each row in gmail_connections, refresh
//     access_token, list messages since last_history_id, fetch + insert into
//     sales.email_messages
//
// Env vars required on Vercel:
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_OAUTH_REDIRECT_URI = https://namkhan-bi.vercel.app/api/auth/gmail/callback
//   CRON_SECRET                = secret used by Vercel cron + manual trigger

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
].join(' ');

export function buildAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirect = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirect) throw new Error('Google OAuth env vars not set');
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirect);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', GMAIL_SCOPES);
  u.searchParams.set('access_type', 'offline');     // get refresh_token
  u.searchParams.set('prompt', 'consent');          // force refresh_token even if already granted
  u.searchParams.set('include_granted_scopes', 'true');
  u.searchParams.set('state', state);
  return u.toString();
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const redirect = process.env.GOOGLE_OAUTH_REDIRECT_URI!;
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
    }),
  });
  if (!r.ok) throw new Error(`Token exchange failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) throw new Error(`Refresh failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as { access_token: string; expires_in: number };
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const r = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Userinfo failed: ${r.status}`);
  const j = (await r.json()) as { email?: string };
  if (!j.email) throw new Error('No email in userinfo response');
  return j.email.toLowerCase();
}

// Persist a new (or refreshed) connection row.
export async function upsertGmailConnection(email: string, refreshToken: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .schema('sales')
    .from('gmail_connections')
    .upsert({
      email,
      refresh_token: refreshToken,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });
  if (error) throw new Error(`upsert failed: ${error.message}`);
}

export async function listGmailConnections() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .schema('sales').from('gmail_connections')
    .select('*').order('email');
  if (error) { console.error('[listGmailConnections]', error); return []; }
  return data ?? [];
}

// ---------- Gmail API helpers ----------

export interface GmailMessageList {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export async function listGmailMessages(
  accessToken: string,
  opts: { q?: string; pageToken?: string; maxResults?: number } = {},
): Promise<GmailMessageList> {
  const u = new URL(`${GMAIL_API}/users/me/messages`);
  if (opts.q) u.searchParams.set('q', opts.q);
  if (opts.pageToken) u.searchParams.set('pageToken', opts.pageToken);
  u.searchParams.set('maxResults', String(opts.maxResults ?? 100));
  const r = await fetch(u, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`list failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as GmailMessageList;
}

export interface GmailMessageFull {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;       // ms since epoch (string)
  payload?: GmailPayload;
}
export interface GmailPayload {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { size: number; data?: string };
  parts?: GmailPayload[];
}

export async function getGmailMessage(accessToken: string, id: string): Promise<GmailMessageFull> {
  const r = await fetch(`${GMAIL_API}/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`get message failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as GmailMessageFull;
}

// Read a single header value
export function getHeader(p: GmailPayload | undefined, name: string): string | null {
  if (!p?.headers) return null;
  const h = p.headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

// Decode a base64url-encoded MIME body (Gmail's encoding)
function b64urlDecode(s: string): string {
  const fixed = s.replace(/-/g, '+').replace(/_/g, '/');
  // Buffer is available in Node runtime
  return Buffer.from(fixed, 'base64').toString('utf-8');
}

// Walk MIME parts to find first text/plain and text/html bodies
export function extractBodies(p: GmailPayload | undefined): { text: string; html: string } {
  let text = '';
  let html = '';
  function walk(part: GmailPayload | undefined) {
    if (!part) return;
    const mime = part.mimeType ?? '';
    if (mime === 'text/plain' && part.body?.data && !text) {
      text = b64urlDecode(part.body.data);
    } else if (mime === 'text/html' && part.body?.data && !html) {
      html = b64urlDecode(part.body.data);
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(p);
  return { text, html };
}
