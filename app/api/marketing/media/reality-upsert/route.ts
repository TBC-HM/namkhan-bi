// app/api/marketing/media/reality-upsert/route.ts
// POST — upsert media.reality_profile for a property_id.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { property_id } = body || {};
  if (!property_id) return NextResponse.json({ error: 'missing_property_id' }, { status: 400 });

  const payload = {
    property_id,
    location: body.location ?? null,
    region: body.region ?? null,
    architecture: body.architecture ?? [],
    materials: body.materials ?? [],
    palette: body.palette ?? [],
    landscape: body.landscape ?? [],
    forbidden: body.forbidden ?? [],
    season_calendar: body.season_calendar ?? {},
    updated_by: 'PBS',
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await sb
      .schema('media')
      .from('reality_profile')
      .upsert(payload, { onConflict: 'property_id' })
      .select('property_id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, property_id: data?.property_id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
