// app/api/marketing/media/area-facets/route.ts
// GET — grouped taxonomy dropdown for /marketing/media Photo Library.
// PBS 2026-07-14 — REVERT + EXTEND: pull from public.v_media_area_taxonomy which
// unions Settings taxonomy (rooms/facilities/activities/certifications/team) with
// three "Other X" review buckets and Uncategorized. Every row carries area_key
// like 'room:511120' / 'facility:1' / 'other:rooms' / 'uncategorized' which
// LibraryTab resolves to the right DB filter (room_type_id / facility_id / …).
// Prior version pulled DISTINCT property_area and erased the Settings link.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Row {
  kind: 'rooms' | 'facilities' | 'activities' | 'certifications' | 'team' | 'other' | 'uncategorized';
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
    .select('kind, sort_order, ref_id, area_key, name, extra, photo_count')
    .eq('property_id', propertyId)
    // PBS 2026-07-15 · exclude 'team' (contacts) — not a photo location, was cluttering the dropdown
    .neq('kind', 'team')
    .order('sort_order')
    .order('photo_count', { ascending: false })
    .order('name');

  if (error) return NextResponse.json({ error: 'facets_failed', detail: error.message }, { status: 500 });

  const rows = (data ?? []) as Row[];
  const groups = {
    rooms:          rows.filter(r => r.kind === 'rooms'),
    facilities:     rows.filter(r => r.kind === 'facilities'),
    activities:     rows.filter(r => r.kind === 'activities'),
    certifications: rows.filter(r => r.kind === 'certifications'),
    team:           rows.filter(r => r.kind === 'team'),
    other:          rows.filter(r => r.kind === 'other'),
    uncategorized:  rows.filter(r => r.kind === 'uncategorized'),
  };

  return NextResponse.json(
    { groups, rows },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
