// app/api/marketing/newsletter/estimate-recipients/route.ts
// PBS 2026-07-22 · Recipient count estimator for a broadcast / director slot / sequence.
// Delegates to public.fn_estimate_recipients (SECURITY DEFINER).
//
// POST { kind: 'broadcast'|'director'|'sequence', id: string }
// → jsonb  { kind, total, property_id, excluded, breakdown }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { kind?: string; id?: string };
    if (!body.kind || !body.id) {
      return NextResponse.json({ error: 'kind and id required' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_estimate_recipients', { p_kind: body.kind, p_id: body.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? { total: 0 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
