// app/api/finance/house-account-receipts/route.ts
//
// Returns Poster POS receipts closed on the same calendar day as a given
// house account opened. Used by the House Accounts drawer drilldown.
//
//   GET /api/finance/house-account-receipts?date=YYYY-MM-DD&property_id=260955

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface PosReceiptLine {
  receipt_id: number;
  open_at: string | null;
  close_at: string | null;
  table_label: string | null;
  waiter: string | null;
  client: string | null;
  payment_method: string | null;
  order_total: number;
  paid: number;
  cash: number;
  card: number;
  cb_reservation_id: string | null;
  customers_count: number | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  const propertyId = Number(url.searchParams.get('property_id') ?? 260955);

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date=YYYY-MM-DD required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .schema('pos')
    .from('poster_receipts')
    .select('receipt_id, open_at, close_at, table_label, waiter, client, payment_method, order_total, paid, cash, card, cb_reservation_id, customers_count')
    .eq('property_id', propertyId)
    .gte('close_at', `${date}T00:00:00`)
    .lte('close_at', `${date}T23:59:59`)
    .order('close_at', { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    date,
    receipts: (data ?? []) as PosReceiptLine[],
  });
}
