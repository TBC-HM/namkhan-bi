// GET /api/auth/gmail/callback
// Google OAuth callback. Exchanges authorization code for tokens, fetches the
// authenticated user's email, persists into sales.gmail_connections.

import { NextResponse } from 'next/server';
import { exchangeCodeForTokens, getUserEmail, upsertGmailConnection } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const stateB64 = url.searchParams.get('state') ?? '';

  let back = '/admin/gmail-connect';
  try {
    const state = JSON.parse(Buffer.from(stateB64, 'base64url').toString('utf-8'));
    if (typeof state.back === 'string') back = state.back;
  } catch {
    /* ignore — fallback to default */
  }

  if (error) {
    return NextResponse.redirect(new URL(`${back}?err=${encodeURIComponent(error)}`, req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL(`${back}?err=missing_code`, req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL(`${back}?err=no_refresh_token`, req.url));
    }
    const email = await getUserEmail(tokens.access_token);
    await upsertGmailConnection(email, tokens.refresh_token);
    return NextResponse.redirect(new URL(`${back}?connected=${encodeURIComponent(email)}`, req.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.redirect(new URL(`${back}?err=${encodeURIComponent(msg)}`, req.url));
  }
}
