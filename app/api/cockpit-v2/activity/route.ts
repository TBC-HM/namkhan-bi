// app/api/cockpit-v2/activity/route.ts
// Polling endpoint for the cockpit-v2 Activity tab. Returns up to ?limit
// (default 200) merged events from cockpit.aud_change_log, cockpit.intake_items,
// cockpit.cap_skill_calls and public.cockpit_audit_log, sorted DESC by time.
//
// Reads only. Service-role client. No auth gate here — Activity is visible
// in the cockpit shell which is already authenticated; cookie-level access
// control happens in middleware.
//
// Author: IT-team agent · 2026-05-13 · #77.

import { NextRequest, NextResponse } from 'next/server';
import { fetchActivityEvents } from '@/app/holding/it/cockpit/_lib/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lRaw = Number.parseInt(url.searchParams.get('limit') ?? '200', 10);
  const limit = Number.isFinite(lRaw) ? Math.min(Math.max(lRaw, 10), 500) : 200;
  const events = await fetchActivityEvents(limit);
  return NextResponse.json(
    { events, count: events.length },
    {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    },
  );
}
