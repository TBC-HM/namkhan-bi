// app/api/marketing/youtube/refresh-dashboard/route.ts
// PBS 2026-07-11 pm — Warms the access token so the next render is fast.
// Client calls this then router.refresh().
import { NextResponse } from 'next/server';
import { getFreshAccessToken } from '@/lib/youtube/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

export async function POST() {
  const tok = await getFreshAccessToken(NAMKHAN);
  if (!tok.ok) {
    return NextResponse.json(
      { ok: false, error: tok.error ?? 'refresh_failed', detail: tok.detail ?? null },
      { status: 400 },
    );
  }
  return NextResponse.json({
    ok:               true,
    refreshed:        tok.refreshed ?? false,
    token_expires_at: tok.token_expires_at ?? null,
  });
}
