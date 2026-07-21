// app/api/marketing/newsletter-templates/list/route.ts
// GET — list newsletter templates for the current property.
// PBS 2026-07-21.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const url = new URL(req.url);
  const propertyId = Number(url.searchParams.get('property_id') ?? 260955);

  const { data, error } = await sb
    .from('v_newsletter_templates')
    .select('*')
    .eq('property_id', propertyId)
    .order('template_key');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
