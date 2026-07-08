// app/api/revenue/reports/recipient/add/route.ts
// PBS 2026-07-08: add a revenue-report recipient via fn_revenue_report_add_recipient RPC.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const property_id  = Number(body.property_id);
    const template_key = String(body.template_key ?? '').toLowerCase();
    const cadence      = ['daily','weekly','monthly'].includes(String(body.cadence ?? '').toLowerCase())
                          ? String(body.cadence).toLowerCase() : 'daily';
    const email        = String(body.email ?? '').trim().toLowerCase();
    const name         = body.name ? String(body.name).trim() : null;
    if (!Number.isFinite(property_id) || property_id <= 0)  return NextResponse.json({ error: 'property_id required' }, { status: 400 });
    if (!template_key)                                       return NextResponse.json({ error: 'template_key required' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))          return NextResponse.json({ error: 'valid email required' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_revenue_report_add_recipient', {
      p_property_id: property_id, p_template_key: template_key, p_email: email, p_name: name, p_cadence: cadence,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: Number(data) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
