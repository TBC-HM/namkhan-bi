// lib/gmail.ts
// Gmail OAuth + polling helpers. Self-contained — no Make.com dependency.
//
// Flow:
//  1. /api/auth/gmail/start   → redirects to Google
//  2. /api/auth/gmail/callback → exchanges code for refresh_token, stores in
//     marketing.user_gmail_connections, redirects back to admin
//  3. /api/cron/poll-gmail    → for each row in user_gmail_connections, refresh
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

// 2026-07-31 (sales brief round 2, A1 fix): resolve the OAuth client from the
// Supabase vault FIRST (unified namkhan-bi-vercel client, rotated 2026-07-13 —
// same source lib/userGmail.ts uses, provably working for token refresh), and
// only fall back to the legacy Vercel env pair. Root cause of the dead sales
// poller: tokens minted under the vault client were being refreshed with the
// stale env GOOGLE_OAUTH_CLIENT_SECRET → Google 401 invalid_client.
async function getOAuthClient(): Promise<{ clientId: string; clientSecret: string }> {
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
  if (!clientId || !clientSecret) throw new Error('Google OAuth client missing in vault + env');
  return { clientId, clientSecret };
}

export async function buildAuthUrl(state: string): Promise<string> {
  const { clientId } = await getOAuthClient();
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
  const { clientId, clientSecret } = await getOAuthClient();
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
  const { clientId, clientSecret } = await getOAuthClient();
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
    .schema('marketing')
    .from('user_gmail_connections')
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
    .schema('marketing').from('user_gmail_connections')
    .select('*').order('email');
  if (error) { console.error('[listGmailConnections]', error); return []; }
  return data ?? [];
}

interface GmailMessageHeader { name: string; value: string }
interface GmailMessageBody { data?: string; size: number }
interface GmailMessagePart {
  partId: string;
  mimeType: string;
  filename?: string;
  headers?: GmailMessageHeader[];
  body?: GmailMessageBody;
  parts?: GmailMessagePart[];
}
interface GmailMessageFull {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: GmailMessagePart;
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export async function listMessages(
  accessToken: string,
  query?: string,
  pageToken?: string,
): Promise<GmailListResponse> {
  const url = new URL(`${GMAIL_API}/users/me/messages`);
  url.searchParams.set('maxResults', '100');
  if (query) url.searchParams.set('q', query);
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`listMessages failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as GmailListResponse;
}

export async function getGmailMessage(accessToken: string, id: string): Promise<GmailMessageFull> {
  const r = await fetch(`${GMAIL_API}/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`getMessage failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as GmailMessageFull;
}

export function getHeader(payload: GmailMessagePart | undefined, name: string): string | null {
  if (!payload?.headers) return null;
  const h = payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

export function extractBodies(payload: GmailMessagePart | undefined): { text: string; html: string } {
  let text = '';
  let html = '';
  function walk(part: GmailMessagePart | undefined) {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += Buffer.from(part.body.data, 'base64url').toString('utf-8');
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html += Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);
  return { text, html };
}
