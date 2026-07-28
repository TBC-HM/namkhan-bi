// app/api/cron/yt_spy_weekly/route.ts
// Middleware-bypassed cron shim for youtube_spy_scan (Spy agent MVP,
// yt-completion brief 2026-07-28). Fired weekly by pg_cron 'yt-spy-weekly'.
// Auth: x-cron-secret / ?secret= against CRON_SHARED_SECRET (CRON_SECRET fallback).
import { NextResponse } from 'next/server';
import { POST as spyScanPOST } from '@/app/api/cockpit/skills/youtube_spy_scan/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const NAMKHAN_PROPERTY_ID = 260955;

function authGate(req: Request): NextResponse | null {
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
  return spyScanPOST(inner);
}
export const GET = POST;
