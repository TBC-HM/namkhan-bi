// app/api/revenue/reports/sends/delete/route.ts
// PBS 2026-07-08: bulk-delete send-log rows.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ids  = Array.isArray(body.ids) ? body.ids.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n)) : [];
    if (ids.length === 0) return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_revenue_report_sends_delete', { p_ids: ids });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: Number(data) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
