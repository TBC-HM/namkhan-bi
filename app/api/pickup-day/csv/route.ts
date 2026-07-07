// app/api/pickup-day/csv/route.ts
// PBS 2026-07-07: CSV export of the day report — same shape as the on-page table
// (subset of wired columns; placeholders omitted).

import { NextResponse } from 'next/server';
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PaceRow {
  stay_date: string; iso_dow: number; rooms_available: number;
  otb_rooms_sold: number; otb_revenue: number;
  otb_occupancy_pct: number; otb_adr: number; otb_revpar: number;
}
interface PickupRow {
  stay_date: string;
  otb_rooms_now: number; otb_rooms_1d_ago: number; otb_rooms_7d_ago: number;
  otb_revenue_now: number; otb_revenue_1d_ago: number; otb_revenue_7d_ago: number;
}

const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const q = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const sb = getSupabaseAdmin();
  const todayIso = new Date().toISOString().slice(0, 10);
  const in365 = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);

  const [pace, pickup] = await Promise.all([
    sb.schema('kpi').from('v_pace_otb_daily')
      .select('stay_date, iso_dow, rooms_available, otb_rooms_sold, otb_revenue, otb_occupancy_pct, otb_adr, otb_revpar')
      .eq('property_id', PROPERTY_ID)
      .gte('stay_date', todayIso).lte('stay_date', in365)
      .order('stay_date'),
    sb.from('v_pickup_day_report')
      .select('stay_date, otb_rooms_now, otb_rooms_1d_ago, otb_rooms_7d_ago, otb_revenue_now, otb_revenue_1d_ago, otb_revenue_7d_ago')
      .eq('property_id', PROPERTY_ID),
  ]);

  const pickupMap = new Map(((pickup.data ?? []) as PickupRow[]).map(r => [r.stay_date, r]));

  const rows: string[] = [];
  rows.push([
    'DoW','Date','OTB %','OCC (rooms sold)','OOO','Available',
    'ADR','Room Rev',
    'Pickup -1d RN','Pickup -1d Rev','Pickup -1d ADR',
    'Pickup -7d RN','Pickup -7d Rev','Pickup -7d ADR',
  ].map(q).join(','));

  for (const r of (pace.data ?? []) as PaceRow[]) {
    const p = pickupMap.get(r.stay_date);
    const p1rn  = p ? p.otb_rooms_now - p.otb_rooms_1d_ago : 0;
    const p1rev = p ? p.otb_revenue_now - p.otb_revenue_1d_ago : 0;
    const p1adr = p1rn !== 0 ? p1rev / p1rn : 0;
    const p7rn  = p ? p.otb_rooms_now - p.otb_rooms_7d_ago : 0;
    const p7rev = p ? p.otb_revenue_now - p.otb_revenue_7d_ago : 0;
    const p7adr = p7rn !== 0 ? p7rev / p7rn : 0;
    const dow = DOW[(r.iso_dow - 1 + 7) % 7];
    const available = Math.max(0, r.rooms_available - r.otb_rooms_sold);
    rows.push([
      dow, r.stay_date, `${Math.round(r.otb_occupancy_pct)}%`, r.otb_rooms_sold, 0, available,
      Math.round(r.otb_adr), Math.round(r.otb_revenue),
      p1rn, Math.round(p1rev), Math.round(p1adr),
      p7rn, Math.round(p7rev), Math.round(p7adr),
    ].map(q).join(','));
  }

  const filename = `day-report-${todayIso}.csv`;
  return new NextResponse(rows.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
