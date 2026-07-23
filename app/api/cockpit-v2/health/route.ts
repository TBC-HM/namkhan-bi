// app/api/cockpit-v2/health/route.ts
// Polling endpoint for the cockpit-v2 Health tab. Returns the same shape as
// fetchHealth(). Read-only.
//
// Author: IT-team agent · 2026-05-13 · #58.

import { NextResponse } from 'next/server';
import { fetchHealth } from '@/app/holding/it/cockpit/_lib/data-port';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

export async function GET() {
  const data = await fetchHealth();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store, must-revalidate' },
  });
}
