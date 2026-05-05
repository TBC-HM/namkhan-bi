// POST /api/inv/count
// Creates inv.counts header + count_lines in one transaction.
// DQ trigger fires automatically for over-threshold variances.
// Used by: Page 9 Stocktake submit.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CountLineInput {
  item_id: string;
  counted_quantity: number;
  system_quantity?: number;
  unit_cost_usd?: number | null;
}

interface CountInput {
  count_date: string;
  location_id: number;
  count_type?: 'periodic' | 'spot' | 'cycle' | 'annual' | 'opening';
  status?: 'draft' | 'submitted';
  notes?: string;
  lines: CountLineInput[];
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: CountInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.count_date || !body.location_id) {
    return NextResponse.json({ error: 'count_date + location_id required' }, { status: 400 });
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: 'lines must contain at least one row' }, { status: 400 });
  }

  // 1. Insert header
  const { data: header, error: hErr } = await admin
    .schema('inv')
    .from('counts')
    .insert({
      count_date: body.count_date,
      location_id: body.location_id,
      count_type: body.count_type ?? 'periodic',
      status: body.status ?? 'submitted',
      notes: body.notes ?? null,
    })
    .select('count_id')
    .maybeSingle();
  if (hErr || !header) return NextResponse.json({ error: hErr?.message ?? 'Insert header failed' }, { status: 500 });

  // 2. Insert lines (only rows where counted_quantity is non-null + a valid number)
  const cleaned = body.lines
    .filter((l) => l.item_id && l.counted_quantity != null && !isNaN(Number(l.counted_quantity)))
    .map((l) => ({
      count_id: header.count_id,
      item_id: l.item_id,
      counted_quantity: Number(l.counted_quantity),
      system_quantity: l.system_quantity != null ? Number(l.system_quantity) : null,
      unit_cost_usd: l.unit_cost_usd != null ? Number(l.unit_cost_usd) : null,
    }));
  if (cleaned.length === 0) {
    return NextResponse.json({ ok: true, count_id: header.count_id, lines_inserted: 0, warning: 'no valid lines' });
  }

  const { error: lErr, count } = await admin.schema('inv').from('count_lines').insert(cleaned, { count: 'exact' });
  if (lErr) return NextResponse.json({ error: lErr.message, count_id: header.count_id }, { status: 500 });

  return NextResponse.json({ ok: true, count_id: header.count_id, lines_inserted: count ?? cleaned.length });
}
