import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const propertyId = Number(url.searchParams.get('property_id'));
    if (!Number.isFinite(propertyId)) return NextResponse.json({ error: 'invalid property_id' }, { status: 400 });

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
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
