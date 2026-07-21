// app/api/marketing/newsletter-templates/list-media/route.ts
// GET — return photos from v_marketing_media_page for the picker modal
// (used by TemplatesClient hero picker + EmailChromePanel logo/hero picker).
// PBS 2026-07-21.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const { data, error } = await sb
    .from('v_marketing_media_page')
    .select('asset_id, original_filename, public_url, quality_index, category, primary_tier')
    .eq('asset_type', 'photo')
    .not('public_url', 'is', null)
    .order('quality_index', { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
