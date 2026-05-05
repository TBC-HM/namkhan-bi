// app/api/compiler/options/route.ts
// GET -> { roomTypes[], ratePlans[] } for the offer config UI.

import { NextResponse } from 'next/server';
import { listRoomTypes, listNrfRatePlans, DEFAULT_RATE_PLAN_ID } from '@/lib/compiler/roomPricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [roomTypes, ratePlans] = await Promise.all([listRoomTypes(), listNrfRatePlans()]);
    return NextResponse.json({ roomTypes, ratePlans, defaultRatePlanId: DEFAULT_RATE_PLAN_ID });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
