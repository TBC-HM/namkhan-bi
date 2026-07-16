// app/api/proposals/activities/route.ts
// PBS 2026-07-16 (item 4) — activity picker source of truth for the composer's
// "+ Experience" button. Reads live rows from Property Settings via the existing
// bridge view public.v_activities_catalog (over content.activities_catalog).
//
// Contract:
//   GET /api/proposals/activities?property_id=260955
//   → { activities: [{ activity_id, property_id, category, name, description,
//                      duration_min, price_amount, price_currency, is_active }] }
//
// The route is intentionally narrow — no filter beyond property_id + is_active,
// no auth required (already gated by the site-wide password wall). If callers
// need richer filtering later, extend the query params rather than the bridge.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawPid = url.searchParams.get('property_id');
  const propertyId = rawPid ? Number(rawPid) : NaN;
  if (!Number.isFinite(propertyId)) {
    return NextResponse.json({ error: 'missing_or_invalid_property_id' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_activities_catalog')
    .select('activity_id, property_id, category, name, description, duration_min, price_amount, price_currency, is_active, display_order')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('[proposals.activities]', error);
    return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ activities: data ?? [] });
}
