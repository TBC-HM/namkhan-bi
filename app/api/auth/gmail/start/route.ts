// GET /api/auth/gmail/start
// Redirects to Google OAuth consent. Used by the "Connect Gmail" button on
// /admin/gmail-connect.
//
// Auth: requires CRON_SECRET in query (?key=...) so randos can't initiate flows.

import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  if (key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // state = random nonce so we can verify on callback (CSRF-ish).
  // Encode the original "from" param so we can redirect back.
  const back = url.searchParams.get('back') ?? '/admin/gmail-connect';
  const state = Buffer.from(JSON.stringify({ back, n: crypto.randomUUID() })).toString('base64url');
  return NextResponse.redirect(buildAuthUrl(state));
}
