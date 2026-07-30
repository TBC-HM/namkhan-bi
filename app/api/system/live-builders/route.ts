// app/api/system/live-builders/route.ts
// Read surface for the builder heartbeat UI (ADR-209). Polled client-side
// every 10s from /holding/it2/system/live. Reads public.v_builder_liveness
// (bridge view over governance.builder_heartbeats, L5 PostgREST bridge law).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_builder_liveness')
    .select('*')
    .order('last_beat_at', { ascending: false })
    .limit(60);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [] });
}
