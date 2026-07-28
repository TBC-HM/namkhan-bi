// app/api/cron/yt_token_refresh/route.ts
// 2026-07-28 (yt-completion brief) — server-side YouTube OAuth token keep-alive.
//
// WHY THIS EXISTS: public.fn_yt_refresh_if_expired originally polled
// net._http_response inside its own transaction — pg_net responses only land
// AFTER the calling transaction commits (pg_net law, agent memory 531), so the
// SQL-side refresh ALWAYS raised 'refresh_timeout'. The reliable refresh path
// is Node-side (lib/youtube/token.ts getFreshAccessToken → form-encoded Google
// refresh + fn_yt_rotate_access_token). This shim exposes that Node path to
// pg_cron so the access token stays perpetually fresh server-side:
// fn_yt_refresh_if_expired now fire-and-forgets a POST here and returns the
// current token without ever raising; the rotation lands on this endpoint.
//
// Auth: x-cron-secret / ?secret= against CRON_SHARED_SECRET (brain-classify
// pattern), CRON_SECRET fallback.
import { NextResponse } from 'next/server';
import { getFreshAccessToken } from '@/lib/youtube/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const res = await getFreshAccessToken(NAMKHAN_PROPERTY_ID);
  // Never return token material — status only.
  return NextResponse.json({
    ok:               res.ok,
    refreshed:        res.refreshed ?? false,
    token_expires_at: res.token_expires_at ?? null,
    error:            res.ok ? undefined : res.error,
    detail:           res.ok ? undefined : res.detail,
  }, { status: res.ok ? 200 : 502 });
}
export const GET = POST;
