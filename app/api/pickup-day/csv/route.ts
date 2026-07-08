// app/api/pickup-day/csv/route.ts
// PBS 2026-07-08: CSV export of the day report.
// Fixes:
//  - UTF-8 BOM prepended so Excel parses columns correctly (was showing "one long column")
//  - Title + property + date metadata rows at the top (was: naked header row)
//  - Rounded numbers (was already rounded on day report; consistent now)
//  - Filename includes property tag
//  - Property is resolvable per request (?property_id=)

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
const round0 = (n: number | null | undefined) => (n == null || !Number.isFinite(n)) ? '' : String(Math.round(n));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pid = Number(url.searchParams.get('property_id') ?? PROPERTY_ID);
  const propLabel = pid === 1000001 ? 'Donna Portals' : 'Namkhan';
  const cur = pid === 1000001 ? 'EUR' : 'USD';
  const sym = cur === 'EUR' ? '€' : '$';

  const sb = getSupabaseAdmin();
  const todayIso = new Date().toISOString().slice(0, 10);
  const in365 = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);

  // Latest Lighthouse snapshot for demand column
  const { data: latestSnap } = await sb.from('v_lighthouse_rateshop')
    .select('shop_date').eq('property_id', pid).order('shop_date', { ascending: false }).limit(1);
  const snapshotDate = latestSnap?.[0]?.shop_date ?? null;

  const [pace, pickup, demand] = await Promise.all([
    sb.schema('kpi').from('v_pace_otb_daily')
      .select('stay_date, iso_dow, rooms_available, otb_rooms_sold, otb_revenue, otb_occupancy_pct, otb_adr, otb_revpar')
      .eq('property_id', pid)
      .gte('stay_date', todayIso).lte('stay_date', in365)
      .order('stay_date'),
    sb.from('v_pickup_day_report')
      .select('stay_date, otb_rooms_now, otb_rooms_1d_ago, otb_rooms_7d_ago, otb_revenue_now, otb_revenue_1d_ago, otb_revenue_7d_ago')
      .eq('property_id', pid),
    snapshotDate
      ? sb.from('v_lighthouse_rateshop')
          .select('stay_date, market_demand')
          .eq('property_id', pid).eq('shop_date', snapshotDate).eq('is_self', true)
      : Promise.resolve({ data: [] as Array<{ stay_date: string; market_demand: number | null }> }),
  ]);

  const pickupMap = new Map(((pickup.data ?? []) as PickupRow[]).map(r => [r.stay_date, r]));
  const demandMap = new Map<string, number>();
  for (const r of ((demand.data ?? []) as Array<{ stay_date: string; market_demand: number | null }>)) {
    if (r.market_demand !== null && r.market_demand !== undefined) demandMap.set(r.stay_date, Number(r.market_demand));
  }

  const lines: string[] = [];
  // Metadata rows Excel picks up as its own columns (each row uses just col A).
  lines.push(q(`Day report · ${propLabel} · Generated ${todayIso}`));
  lines.push(q(`Property ID ${pid} · Currency ${cur} · Nights from today to ${in365}`));
  lines.push(q(`Demand column source: Lighthouse snapshot ${snapshotDate ?? 'n/a'}`));
  lines.push('');
  lines.push([
    'DoW','Date','Demand %','OCC %','OTB (rooms sold)','OoO','Avail',
    `ADR (${sym})`, `Room Rev (${sym})`,
    'Pickup -1d RN', `Pickup -1d Rev (${sym})`, `Pickup -1d ADR (${sym})`,
    'Pickup -7d RN', `Pickup -7d Rev (${sym})`, `Pickup -7d ADR (${sym})`,
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
    const dv = demandMap.get(r.stay_date);
    const demandCell = dv !== undefined ? `${Math.round(dv * 100)}%` : '';
    lines.push([
      dow, r.stay_date, demandCell, `${Math.round(r.otb_occupancy_pct)}%`,
      r.otb_rooms_sold, 0, available,
      round0(r.otb_adr), round0(r.otb_revenue),
      p1rn, round0(p1rev), round0(p1adr),
      p7rn, round0(p7rev), round0(p7adr),
    ].map(q).join(','));
  }

  const filename = `day-report-${propLabel.toLowerCase().replace(/\s+/g, '-')}-${todayIso}.csv`;
  // UTF-8 BOM → Excel parses columns correctly on all locales.
  const csv = '﻿' + lines.join('\r\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
