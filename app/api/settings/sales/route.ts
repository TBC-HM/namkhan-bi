// app/api/settings/sales/route.ts
// 2026-09-09 (L22/ADR-281): property_id came straight from the request body with
// no access check, so any authenticated caller could rewrite another tenant's
// group thresholds and discount authority tiers. Now verified with requirePropertyAccess() and written from
// the VERIFIED id, never the client-supplied one.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { property_id: _raw, ...fields } = body;

    let propertyId: number;
    try {
      propertyId = await requirePropertyAccess(req, _raw);
    } catch (e) {
      if (e instanceof Response) return e;
      return NextResponse.json({ error: 'authorization_check_failed' }, { status: 403 });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .schema('property')
      .from('sales_config')
      .upsert({ property_id: propertyId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'property_id' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
