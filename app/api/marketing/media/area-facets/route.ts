// app/api/marketing/media/area-facets/route.ts
// GET — grouped taxonomy dropdown for /marketing/media Photo Library.
// PBS 2026-07-18 v3 — extended kinds so the Library dropdown mirrors Property
// Settings sidebar: rooms (Accommodation) · facilities (generic non-wellness
// non-dining) · jungle_spa · fnb · activities · retreats · imekong · certs ·
// destination · other · uncategorized. Team dropped (contacts noise). All
// derived from public.v_media_area_taxonomy which now splits facilities by
// category and unions retreats + boats/cruises for zero-config extension.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Row {
  kind: 'rooms' | 'facilities' | 'jungle_spa' | 'fnb' | 'activities' | 'retreats' | 'transport' | 'imekong'
       | 'certifications' | 'team' | 'destination' | 'other' | 'uncategorized';
  sort_order: number;
  ref_id: string;
  area_key: string;
  name: string;
  extra: string | null;
  photo_count: number;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const propertyId = Number(url.searchParams.get('property_id') ?? 260955);

  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  const { data, error } = await sb
    .from('v_media_area_taxonomy')
    .select('kind, sort_order, ref_id, area_key, name, extra, sort_key, photo_count')
    .eq('property_id', propertyId)
    // Team = contacts, not a location — drop from dropdown per 2026-07-15 decision
    .neq('kind', 'team')
    // Order by kind's sort_order, then by sort_key (keeps parent + virtual sub-folder adjacent)
    .order('sort_order')
    .order('sort_key');

  if (error) return NextResponse.json({ error: 'facets_failed', detail: error.message }, { status: 500 });

  const rows = (data ?? []) as Row[];
  const groups = {
    rooms:          rows.filter(r => r.kind === 'rooms'),
    facilities:     rows.filter(r => r.kind === 'facilities'),
    jungle_spa:     rows.filter(r => r.kind === 'jungle_spa'),
    fnb:            rows.filter(r => r.kind === 'fnb'),
    activities:     rows.filter(r => r.kind === 'activities'),
    retreats:       rows.filter(r => r.kind === 'retreats'),
    transport:      rows.filter(r => r.kind === 'transport'),
    imekong:        rows.filter(r => r.kind === 'imekong'),
    certifications: rows.filter(r => r.kind === 'certifications'),
    team:           rows.filter(r => r.kind === 'team'),
    destination:    rows.filter(r => r.kind === 'destination'),
    other:          rows.filter(r => r.kind === 'other'),
    uncategorized:  rows.filter(r => r.kind === 'uncategorized'),
  };

  return NextResponse.json(
    { groups, rows },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
