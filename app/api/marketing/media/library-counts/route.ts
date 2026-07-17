// app/api/marketing/media/library-counts/route.ts
// PBS 2026-07-17 — SCOPE 1 of media-pipeline-frontend brief (ADR-149..152 consumers).
// Returns the single canonical row from public.v_media_library_counts.
// Backend is LIVE; this route is a thin PostgREST pass-through so LibraryTab.tsx
// stops recomputing tile counts client-side (the source of the 832-vs-1125 bug).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pid = Number(url.searchParams.get('propertyId') ?? url.searchParams.get('pid') ?? '260955');
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ error: 'bad propertyId' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_media_library_counts')
    .select('property_id, pics_ready, videos_total, with_tier, with_area, to_clarify, destination, review_junk, website, ota, social, internal')
    .eq('property_id', pid)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, counts: data ?? null });
}
