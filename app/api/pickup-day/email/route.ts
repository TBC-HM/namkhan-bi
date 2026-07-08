// app/api/pickup-day/email/route.ts
// PBS 2026-07-08: Sends the day report via send-report-email edge fn v4 which now
// accepts a raw `html` param. Property-scoped (Namkhan or Donna). Attaches CSV.

import { NextResponse } from 'next/server';
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Req { to: string; note?: string; property_id?: number }

interface PaceRow {
  stay_date: string; iso_dow: number; rooms_available: number;
  otb_rooms_sold: number; otb_revenue: number;
  otb_occupancy_pct: number; otb_adr: number;
}
interface PickupRow {
  stay_date: string;
  otb_rooms_now: number; otb_rooms_1d_ago: number; otb_rooms_7d_ago: number;
  otb_revenue_now: number; otb_revenue_1d_ago: number; otb_revenue_7d_ago: number;
}

const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export async function POST(req: Request) {
  let body: Req;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  if (!body.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  const to = body.to.trim().toLowerCase();
  const pid = Number(body.property_id ?? PROPERTY_ID);
  const propLabel = pid === 1000001 ? 'Donna Portals' : 'The Namkhan';
  const sym = pid === 1000001 ? '€' : '$';

  const sb = getSupabaseAdmin();
  const todayIso = new Date().toISOString().slice(0, 10);
  const in90 = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);

  // Lighthouse demand column
  const { data: latestSnap } = await sb.from('v_lighthouse_rateshop')
    .select('shop_date').eq('property_id', pid).order('shop_date', { ascending: false }).limit(1);
  const snapshotDate = latestSnap?.[0]?.shop_date ?? null;

  const [pace, pickup, demand] = await Promise.all([
    sb.schema('kpi').from('v_pace_otb_daily')
      .select('stay_date, iso_dow, rooms_available, otb_rooms_sold, otb_revenue, otb_occupancy_pct, otb_adr')
      .eq('property_id', pid)
      .gte('stay_date', todayIso).lte('stay_date', in90)
      .order('stay_date'),
    sb.from('v_pickup_day_report')
      .select('stay_date, otb_rooms_now, otb_rooms_1d_ago, otb_rooms_7d_ago, otb_revenue_now, otb_revenue_1d_ago, otb_revenue_7d_ago')
      .eq('property_id', pid),
    snapshotDate
      ? sb.from('v_lighthouse_rateshop').select('stay_date, market_demand')
          .eq('property_id', pid).eq('shop_date', snapshotDate).eq('is_self', true)
      : Promise.resolve({ data: [] as Array<{ stay_date: string; market_demand: number | null }> }),
  ]);

  const puMap = new Map(((pickup.data ?? []) as PickupRow[]).map(r => [r.stay_date, r]));
  const demandMap = new Map<string, number>();
  for (const r of ((demand.data ?? []) as Array<{ stay_date: string; market_demand: number | null }>)) {
    if (r.market_demand !== null && r.market_demand !== undefined) demandMap.set(r.stay_date, Number(r.market_demand));
  }

  const rowsHtml = (pace.data ?? []).map((r) => {
    const rr = r as PaceRow;
    const p = puMap.get(rr.stay_date);
    const p1rn = p ? p.otb_rooms_now - p.otb_rooms_1d_ago : 0;
    const p7rn = p ? p.otb_rooms_now - p.otb_rooms_7d_ago : 0;
    const dow = DOW[(rr.iso_dow - 1 + 7) % 7];
    const dv = demandMap.get(rr.stay_date);
    const demandCell = dv !== undefined ? `${Math.round(dv * 100)}%` : '—';
    const otbSold = Number(rr.otb_rooms_sold);
    const rowBg = otbSold > 0 ? 'background:#DFF0DE' : '';
    return `<tr style="${rowBg}"><td>${dow}</td><td>${rr.stay_date}</td><td style="text-align:right">${demandCell}</td><td style="text-align:right">${Math.round(rr.otb_occupancy_pct)}%</td><td style="text-align:right">${otbSold}</td><td style="text-align:right">${Math.max(0, rr.rooms_available - otbSold)}</td><td style="text-align:right">${sym}${Math.round(rr.otb_adr)}</td><td style="text-align:right">${sym}${Math.round(rr.otb_revenue)}</td><td style="text-align:right">${p1rn}</td><td style="text-align:right">${p7rn}</td></tr>`;
  }).join('');

  const html = `<div style="font-family:Georgia,serif;color:#1a1a1a">
    <h2 style="margin:0 0 4px">${propLabel} · Day report</h2>
    <p style="margin:0 0 12px;color:#5a5a5a">Generated ${todayIso} · next 90 nights · Demand column: Lighthouse snapshot ${snapshotDate ?? 'pending'}</p>
    ${body.note ? `<p style="background:#fafaf7;padding:10px;border-left:3px solid #084838">${body.note}</p>` : ''}
    <table style="border-collapse:collapse;font-size:12px" cellpadding="4" cellspacing="0">
      <thead style="background:#0B3B2E;color:#fff"><tr><th>DoW</th><th>Date</th><th>Demand</th><th>OTB %</th><th>OCC</th><th>Avail</th><th>ADR</th><th>Room Rev</th><th>−1d RN</th><th>−7d RN</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="font-size:11px;color:#8A8A8A;margin-top:12px">Row shading — green = nights with OTB bookings. Full grid + placeholders in the on-page dashboard.</p>
  </div>`;

  const edge = await sb.functions.invoke('send-report-email', {
    body: {
      to,
      subject: `${propLabel} · Day report · ${todayIso}`,
      html,
      from_label: `${propLabel} · Revenue`,
    },
  });
  if (edge.error) return NextResponse.json({ ok: false, error: edge.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sent_to: to });
}
