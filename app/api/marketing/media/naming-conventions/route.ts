// app/api/marketing/media/naming-conventions/route.ts
// GET ?property_id=<n> — list naming conventions for a property.
// Includes global rules (property_id IS NULL). Ordered property-specific first.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  const propertyId = Number(req.nextUrl.searchParams.get('property_id') ?? '');
  if (!propertyId || Number.isNaN(propertyId)) {
    return NextResponse.json({ error: 'property_id required' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('v_media_naming_conventions')
    .select('id, property_id, scope, pattern, regex, examples, description, active, created_at, updated_at')
    .or(`property_id.eq.${propertyId},property_id.is.null`)
    .order('property_id', { ascending: false, nullsFirst: false })
    .order('scope', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, rules: data ?? [] });
}
