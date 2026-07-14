// app/api/marketing/media/settings/route.ts
// GET  ?property_id=X  → { property_id, archive_threshold, auto_archive, updated_at }
// POST { property_id, archive_threshold?, auto_archive? } → upsert via public.fn_media_settings_upsert
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const propertyId = Number(url.searchParams.get('property_id') ?? 260955);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_media_settings')
    .select('*')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    data ?? { property_id: propertyId, archive_threshold: 30, auto_archive: false },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body?.property_id) return NextResponse.json({ error: 'property_id_required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_media_settings_upsert', { p: body });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, property_id: data });
}
