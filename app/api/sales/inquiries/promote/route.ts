// app/api/sales/inquiries/promote/route.ts
// PBS 2026-07-11 pm — Sales CRM UI (ADR-147). "Add to pipeline" from inbound queue.
// Wraps sales.fn_promote_inquiry (SECURITY DEFINER). Enters at stage=engaged (already showed intent).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { inquiry_id: string };
    const inquiryId = String(b.inquiry_id ?? '').trim();
    if (!inquiryId) return NextResponse.json({ error: 'inquiry_id required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.schema('sales').rpc('fn_promote_inquiry', { p_inquiry_id: inquiryId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, lead_id: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
