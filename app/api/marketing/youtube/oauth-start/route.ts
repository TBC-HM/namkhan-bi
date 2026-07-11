// app/api/marketing/youtube/oauth-start/route.ts
// PBS 2026-07-11 pm — Kick off Google OAuth for YouTube channel connection.
// PKCE + state persist to marketing.yt_channel_connections via fn_yt_start_oauth.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REDIRECT_URI = 'https://namkhan-bi.vercel.app/api/marketing/youtube/oauth-callback';
const SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl', // PBS 2026-07-11 pm: required for commentThreads.list + comments.insert (fixes 403 insufficientPermissions)
  'https://www.googleapis.com/auth/youtubepartner',
].join(' ');

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const propertyId = Number(url.searchParams.get('property_id') ?? '260955');

  const sb = getSupabaseAdmin();

  // Fetch OAuth client id from vault
  const { data: clientIdRow, error: cidErr } = await sb.rpc('fn_get_secret', { p_name: 'YOUTUBE_OAUTH_CLIENT_ID' });
  if (cidErr || !clientIdRow) {
    return NextResponse.json({ ok: false, error: 'vault_client_id_missing', detail: cidErr?.message }, { status: 500 });
  }
  const clientId = String(clientIdRow).trim();

  // Generate PKCE + state
  const codeVerifier = b64url(crypto.randomBytes(72)).slice(0, 96);
  const codeChallenge = b64url(crypto.createHash('sha256').update(codeVerifier).digest());
  const state = b64url(crypto.randomBytes(24)).slice(0, 32);

  // Persist pending connection row via SECURITY DEFINER RPC (public schema)
  const { error: insErr } = await sb.rpc('fn_yt_start_oauth', {
    p_property_id: propertyId,
    p_state:       state,
    p_verifier:    codeVerifier,
  });
  if (insErr) {
    return NextResponse.json({ ok: false, error: 'persist_state_failed', detail: insErr.message }, { status: 500 });
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('include_granted_scopes', 'true');

  return NextResponse.redirect(authUrl.toString(), 302);
}
