// app/api/sales/leads/promote/route.ts
// PBS 2026-07-11 pm — Sales CRM UI (ADR-147). Convert-to-client action.
// Wraps sales.fn_promote_lead (SECURITY DEFINER). Surfaced from Negotiation stage only.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { lead_id: number };
    const leadId = Number(b.lead_id);
    if (!Number.isFinite(leadId) || leadId <= 0) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.schema('sales').rpc('fn_promote_lead', { p_lead_id: leadId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, result: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
