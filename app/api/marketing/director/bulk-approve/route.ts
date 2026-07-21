// app/api/marketing/director/bulk-approve/route.ts
// PBS 2026-07-22 (Newsletter Engine v2): approve every proposed/refined slot in a date range.
// POST { property_id: number, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', schedule?: boolean }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { property_id?: number; from?: string; to?: string; schedule?: boolean };
    const pid = Number(body.property_id ?? 260955);
    if (!body.from || !body.to) return NextResponse.json({ error: 'from and to required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_director_bulk_approve', {
      p_property_id: pid,
      p_from: body.from,
      p_to: body.to,
      p_schedule: body.schedule ?? false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, approved_count: data ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
