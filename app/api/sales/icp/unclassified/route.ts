// app/api/sales/icp/unclassified/route.ts — Drill to unclassified bookings (A5)
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = getSupabaseAdmin();
  
  const { data, error } = await sb
    .from('v_icp_bookings_classified' as any)
    .select('*')
    .eq('icp_key', 'unclassified')
    .order('check_in_date', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bookings: data || [] });
}
