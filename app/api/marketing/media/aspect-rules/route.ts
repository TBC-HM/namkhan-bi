// app/api/marketing/media/aspect-rules/route.ts
// GET — return active channel aspect-ratio rules for the AssetEditDrawer's
// "Crop to…" dropdown. Cheap read from v_media_aspect_ratio_rules.
// PBS 2026-07-14 · Media QA v2 · Task 4.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  const { data, error } = await sb
    .from('v_media_aspect_ratio_rules')
    .select('channel, ratio, min_width_px, min_height_px, notes, active')
    .eq('active', true)
    .order('channel');
  if (error) return NextResponse.json({ error: 'lookup_failed', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rules: data ?? [] });
}
