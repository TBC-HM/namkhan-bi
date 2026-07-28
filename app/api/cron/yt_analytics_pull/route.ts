// app/api/cron/yt_analytics_pull/route.ts
// Middleware-bypassed cron shim for youtube_analytics_pull.
import { NextResponse } from 'next/server';
import { POST as analyticsPullPOST } from '@/app/api/cockpit/skills/youtube_analytics_pull/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN_PROPERTY_ID = 260955;

function authGate(req: Request): NextResponse | null {
  // 2026-07-28 (yt-completion brief): accept CRON_SHARED_SECRET — the secret
  // pg_cron actually sends (brain-classify pattern). CRON_SECRET-only 401'd
  // every scheduled fire of job 137.
  const required = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET;
  if (!required) return null;
  const url = new URL(req.url);
  const provided = url.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? '';
  if (provided !== required) return NextResponse.json({ ok: false, error: 'cron_secret_invalid' }, { status: 401 });
  return null;
}

export async function POST(req: Request) {
  const gate = authGate(req);
  if (gate) return gate;
  const inner = new Request('http://cron.local/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ property_id: NAMKHAN_PROPERTY_ID }),
  });
  return analyticsPullPOST(inner);
}
export const GET = POST;
