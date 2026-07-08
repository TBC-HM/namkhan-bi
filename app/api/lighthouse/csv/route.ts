// app/api/lighthouse/csv/route.ts
// PBS 2026-07-08: CSV export of the Lighthouse compset snapshot.
// One row per (stay_date × hotel) — flattened for spreadsheet analysis.
// Excel-friendly UTF-8 BOM + metadata rows on top.

import { NextResponse } from 'next/server';
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const q = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const round0 = (n: number | null | undefined) => (n == null || !Number.isFinite(n)) ? '' : String(Math.round(n));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pid = Number(url.searchParams.get('property_id') ?? PROPERTY_ID);
  const propLabel = pid === 1000001 ? 'Donna Portals' : 'The Namkhan';
  const cur = pid === 1000001 ? 'EUR' : 'USD';
  const todayIso = new Date().toISOString().slice(0, 10);

  const sb = getSupabaseAdmin();
  // Latest snapshot
  const { data: latestSnap } = await sb.from('v_lighthouse_rateshop')
    .select('shop_date').eq('property_id', pid).order('shop_date', { ascending: false }).limit(1);
  const snapshotDate = latestSnap?.[0]?.shop_date ?? null;
  if (!snapshotDate) {
    return NextResponse.json({ error: 'no_snapshot' }, { status: 404 });
  }

  const { data: rows } = await sb.from('v_lighthouse_rateshop')
    .select('stay_date, hotel_name, is_self, bar_rate, rate_status_raw, currency, median_compset, compset_rank, ota_ranking, market_demand, holidays, events')
    .eq('property_id', pid).eq('shop_date', snapshotDate)
    .order('stay_date').order('is_self', { ascending: false }).order('hotel_name');

  const lines: string[] = [];
  lines.push(q(`Lighthouse compset · ${propLabel} · Generated ${todayIso}`));
  lines.push(q(`Property ID ${pid} · Snapshot date ${snapshotDate} · Currency ${cur}`));
  lines.push('');
  lines.push([
    'Stay date','Hotel','Is own','Rate','Restriction',
    'Median compset','Compset rank','Booking.com ranking','Market demand %',
    'Holidays','Events',
  ].map(q).join(','));

  for (const r of (rows ?? []) as any[]) {
    const demand = r.market_demand != null ? `${Math.round(Number(r.market_demand) * 100)}%` : '';
    lines.push([
      r.stay_date, r.hotel_name, r.is_self ? 'yes' : '',
      round0(r.bar_rate), r.rate_status_raw ?? '',
      round0(r.median_compset), r.compset_rank ?? '',
      r.ota_ranking ?? '', demand,
      r.holidays ?? '', r.events ?? '',
    ].map(q).join(','));
  }

  const filename = `lighthouse-${propLabel.toLowerCase().replace(/\s+/g, '-')}-${snapshotDate}.csv`;
  const csv = '﻿' + lines.join('\r\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
