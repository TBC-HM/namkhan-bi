// app/api/cron/yt_trend_scout/route.ts
// Middleware-bypassed cron shim for youtube_trend_scout.
// Calls the skill handler internally (no HTTP hop), avoiding re-auth.
// Env vars: CRON_SECRET (optional) — if set, request must carry ?secret= or x-cron-secret header.

import { NextResponse } from 'next/server';
import { POST as trendScoutPOST } from '@/app/api/cockpit/skills/youtube_trend_scout/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN_PROPERTY_ID = 260955;

function authGate(req: Request): NextResponse | null {
  const required = process.env.CRON_SECRET;
  if (!required) return null;   // no guard configured — open
  const url = new URL(req.url);
  const provided = url.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? '';
  if (provided !== required) return NextResponse.json({ ok: false, error: 'cron_secret_invalid' }, { status: 401 });
  return null;
}

export async function POST(req: Request) {
  const gate = authGate(req);
  if (gate) return gate;
  const forwardBody = JSON.stringify({ property_id: NAMKHAN_PROPERTY_ID });
  const inner = new Request('http://cron.local/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: forwardBody,
  });
  return trendScoutPOST(inner);
}

export const GET = POST;
