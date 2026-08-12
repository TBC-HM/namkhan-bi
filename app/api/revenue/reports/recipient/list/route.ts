import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawPropertyId = url.searchParams.get('property_id');

    // ADR-281 L22: enforce property access
    const propertyId = await requirePropertyAccess(req, rawPropertyId);

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('v_revenue_report_recipients')
      .select('id, property_id, template_key, email, name, active, created_at')
      .eq('property_id', propertyId)
      .order('template_key', { ascending: true })
      .order('created_at',  { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ recipients: data ?? [] });
  } catch (e) {
    // requirePropertyAccess throws Response on 403/400
    if (e instanceof Response) throw e;
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
