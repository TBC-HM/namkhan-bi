// app/api/cockpit-v2/notify/route.ts
// Polling endpoint for cockpit-v2 Notify tab. Reads cockpit_pbs_notifications
// (service role, public schema). Read-only.
//
// Author: IT-team agent · 2026-05-13 · #58.

import { NextRequest, NextResponse } from 'next/server';
import { fetchNotifications } from '@/app/holding/it/cockpit/_lib/data-port';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lRaw = Number.parseInt(url.searchParams.get('limit') ?? '80', 10);
  const limit = Number.isFinite(lRaw) ? Math.min(Math.max(lRaw, 10), 200) : 80;
  const rows = await fetchNotifications(limit);
  return NextResponse.json(
    { rows, count: rows.length },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } },
  );
}
