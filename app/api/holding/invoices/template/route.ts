// app/api/holding/invoices/template/route.ts
// PBS 2026-07-08: save the editable invoice template.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('v_holding_invoice_template').select('*').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data ?? null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      brand_name: string; brand_color: string; header_line: string; footer_line: string;
      default_notes: string; default_currency: string; default_tax_pct: number;
    };
    if (!body.brand_name?.trim()) return NextResponse.json({ error: 'brand_name required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_holding_invoice_template_save', {
      p_brand_name: body.brand_name.trim(),
      p_brand_color: body.brand_color || '#084838',
      p_header_line: body.header_line || null,
      p_footer_line: body.footer_line || 'The Beyond Circle · Holding · issued via Namkhan BI cockpit.',
      p_default_notes: body.default_notes || null,
      p_default_currency: body.default_currency || 'EUR',
      p_default_tax_pct: Number(body.default_tax_pct) || 0,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: Number(data) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
