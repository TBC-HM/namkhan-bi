// app/api/newsletter/pickable-guests/route.ts
// PBS 2026-07-04: server-side list for the ad-hoc dispatch drawer.
// Uses SERVICE_ROLE via getSupabaseAdmin so we never expose secrets client-side.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('v_newsletter_pickable_guests')
    .select('guest_id, full_name, email, country, gender, total_stays, is_repeat, last_stay_date')
    .eq('property_id', PROPERTY_ID)
    .order('last_stay_date', { ascending: false, nullsFirst: false })
    .limit(5000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, guests: data || [] });
}
