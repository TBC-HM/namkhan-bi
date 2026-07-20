// app/api/proposals/activities/route.ts
// PBS 2026-07-16 (item 4) — activity picker source of truth for the composer's
// "+ Experience" button. Reads live rows from Property Settings.
// PBS 2026-07-20 pm — extended to also return transport_options + boat_cruises
// so the composer picker surfaces every guest-facing extra we can add to an
// offer. Each row carries a `kind` discriminator ('activity' | 'transport' |
// 'cruise') and a compound `activity_id` string (`{kind}:{numeric_id}`) so the
// picker can round-trip the correct ref_table when creating a proposal block.
//
// Contract:
//   GET /api/proposals/activities?property_id=260955
//   → { activities: [{ activity_id, kind, category, name, description,
//                      duration_min, price_amount, price_currency, is_active }] }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UnifiedRow {
  activity_id: string;
  kind: 'activity' | 'transport' | 'cruise';
  category: string | null;
  name: string;
  description: string | null;
  duration_min: number | null;
  price_amount: number | null;
  price_currency: string | null;
  is_active: boolean;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawPid = url.searchParams.get('property_id');
  const propertyId = rawPid ? Number(rawPid) : NaN;
  if (!Number.isFinite(propertyId)) {
    return NextResponse.json({ error: 'missing_or_invalid_property_id' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const [aRes, tRes, cRes] = await Promise.all([
    sb.from('v_activities_catalog')
      .select('activity_id, category, name, description, duration_min, price_amount, price_currency, is_active, display_order')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true }),
    sb.schema('property').from('transport_options')
      .select('transport_id, name, transport_type, description, duration_min, price_amount, price_currency, is_active, display_order')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true }),
    sb.schema('property').from('boat_cruises')
      .select('cruise_id, name, cruise_type, description, duration_min, price_amount, price_currency, is_active, display_order')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true }),
  ]);

  const activities: UnifiedRow[] = ((aRes.data ?? []) as any[]).map(r => ({
    activity_id: `activity:${r.activity_id}`,
    kind: 'activity' as const,
    category: r.category ?? null,
    name: r.name,
    description: r.description ?? null,
    duration_min: r.duration_min ?? null,
    price_amount: r.price_amount != null ? Number(r.price_amount) : null,
    price_currency: r.price_currency ?? 'USD',
    is_active: r.is_active !== false,
  }));

  const transport: UnifiedRow[] = ((tRes.data ?? []) as any[]).map(r => ({
    activity_id: `transport:${r.transport_id}`,
    kind: 'transport' as const,
    category: r.transport_type ?? null,
    name: r.name,
    description: r.description ?? null,
    duration_min: r.duration_min ?? null,
    price_amount: r.price_amount != null ? Number(r.price_amount) : null,
    price_currency: r.price_currency ?? 'USD',
    is_active: r.is_active !== false,
  }));

  const cruises: UnifiedRow[] = ((cRes.data ?? []) as any[]).map(r => ({
    activity_id: `cruise:${r.cruise_id}`,
    kind: 'cruise' as const,
    category: r.cruise_type ?? null,
    name: r.name,
    description: r.description ?? null,
    duration_min: r.duration_min ?? null,
    price_amount: r.price_amount != null ? Number(r.price_amount) : null,
    price_currency: r.price_currency ?? 'USD',
    is_active: r.is_active !== false,
  }));

  return NextResponse.json({ activities: [...activities, ...transport, ...cruises] });
}