// app/api/marketing/social/sync-analytics/route.ts
// Syncs Upload Post analytics for all connected profiles (or one property).
// Delegates to social-push edge fn (mode=analytics).
// One snapshot per property × platform × day in upload_post_analytics.
//
// POST { property_id? }  |  GET (cron-safe, syncs all active profiles)

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { property_id?: number };
  return invoke(body.property_id ? Number(body.property_id) : null);
}

export async function GET() {
  return invoke(null);
}

async function invoke(propertyId: number | null) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.functions.invoke('social-push', {
    body: { mode: 'analytics', property_id: propertyId },
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json(data);
}
