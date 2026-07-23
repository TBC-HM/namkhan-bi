// app/api/cockpit-v2/cost/route.ts
// Polling endpoint for cockpit-v2 Cost tab. Returns the V2CostBreakdown
// payload. Read-only.
//
// Author: IT-team agent · 2026-05-13 · #58.

import { NextResponse } from 'next/server';
import { fetchCostBreakdown } from '@/app/holding/it/cockpit/_lib/data-port';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

export async function GET() {
  const data = await fetchCostBreakdown();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store, must-revalidate' },
  });
}
