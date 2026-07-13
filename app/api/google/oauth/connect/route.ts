// app/api/google/oauth/connect/route.ts
// PBS 2026-07-03: kicks off Google Business Profile OAuth.
// Visit /api/google/oauth/connect?property=260955 to start.
// 2026-07-13: read client_id from vault via fn_get_secret RPC — no more hardcoded stale IDs.
//   Matches the YT OAuth pattern (see app/api/marketing/youtube/oauth-start/route.ts).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const REDIRECT = 'https://namkhan-bi.vercel.app/api/google/oauth/callback';
const SCOPE = [
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata',
].join(' ');

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const propertyID = req.nextUrl.searchParams.get('property') ?? '260955';

  // Read client_id from Supabase vault (rotated 2026-07-13 to unified namkhan-bi-vercel client).
  // Fallback to process.env.GOOGLE_CLIENT_ID for local dev / Vercel env override.
  let clientId: string | undefined = process.env.GOOGLE_CLIENT_ID;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_get_secret', { p_name: 'GOOGLE_CLIENT_ID' });
    if (!error && typeof data === 'string' && data.length > 20) clientId = data;
  } catch (e) { /* keep env fallback */ }

  if (!clientId) {
    return NextResponse.json({ error: 'client_id_missing', detail: 'GOOGLE_CLIENT_ID not in vault or env' }, { status: 500 });
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id',     clientId);
  url.searchParams.set('redirect_uri',  REDIRECT);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope',         SCOPE);
  url.searchParams.set('access_type',   'offline');
  url.searchParams.set('prompt',        'consent');
  url.searchParams.set('state',         propertyID);
  return NextResponse.redirect(url.toString(), 302);
}
