// app/api/marketing/media/area-facets/route.ts
// GET — DISTINCT property_area values with photo counts from v_marketing_media_page.
// PBS 2026-07-14 — data-driven "All areas" dropdown on /marketing/media Photo Library.
// Static list from Settings taxonomy showed 0 photos for fine-grained rooms/facilities
// because 1,005 photos are tagged with coarse values (pool/restaurant/rooms/etc).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  const { data, error } = await sb
    .from('v_marketing_media_page')
    .select('property_area')
    .eq('asset_type', 'photo')
    .not('property_area', 'is', null)
    .neq('property_area', '');

  if (error) return NextResponse.json({ error: 'facets_failed', detail: error.message }, { status: 500 });

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ property_area: string | null }>) {
    const a = (row.property_area ?? '').trim();
    if (!a) continue;
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const areas = Array.from(counts.entries())
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));

  return NextResponse.json(
    { areas },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
