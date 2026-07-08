// app/api/pickup-day/email/route.ts
// PBS 2026-07-08: send SHORT summary in body + attach FULL CSV (next 365 nights).
// Previous behaviour pasted the whole grid inline. Uses send-report-email edge fn v4.

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
const q = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const round0 = (n: number | null | undefined) => (n == null || !Number.isFinite(n)) ? '' : String(Math.round(n));

export async function POST(req: Request) {
  let body: Req;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  if (!body.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  const to = body.to.trim().toLowerCase();
  const pid = Number(body.property_id ?? PROPERTY_ID);
  const propLabel = pid === 1000001 ? 'Donna Portals' : 'The Namkhan';
  const cur = pid === 1000001 ? 'EUR' : 'USD';
  const sym = pid === 1000001 ? '€' : '$';

  const sb = getSupabaseAdmin();
  const todayIso = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const in365 = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);

  // Latest Lighthouse snapshot
  const { data: latestSnap } = await sb.from('v_lighthouse_rateshop')
    .select('shop_date').eq('property_id', pid).order('shop_date', { ascending: false }).limit(1);
  const snapshotDate = latestSnap?.[0]?.shop_date ?? null;

  const [pace365, pickup, demand] = await Promise.all([
    sb.schema('kpi').from('v_pace_otb_daily')
      .select('stay_date, iso_dow, rooms_available, otb_rooms_sold, otb_revenue, otb_occupancy_pct, otb_adr')
      .eq('property_id', pid)
      .gte('stay_date', todayIso).lte('stay_date', in365)
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

  const paceAll = (pace365.data ?? []) as PaceRow[];
  const pace14 = paceAll.filter(r => r.stay_date <= in14);

  // Short summary tiles for email body: next 14 nights
  const totRN14 = pace14.reduce((s, r) => s + Number(r.otb_rooms_sold), 0);
  const totRev14 = pace14.reduce((s, r) => s + Number(r.otb_revenue), 0);
  const totCap14 = pace14.reduce((s, r) => s + Number(r.rooms_available), 0);
  const occ14 = totCap14 > 0 ? Math.round((totRN14 / totCap14) * 100) : 0;
  const adr14 = totRN14 > 0 ? Math.round(totRev14 / totRN14) : 0;
  // Pickup last 24h (across next 14 nights)
  const puTot14 = pace14.reduce((sum, r) => {
    const p = puMap.get(r.stay_date);
    if (!p) return sum;
    return sum + Math.max(0, Number(p.otb_rooms_now) - Number(p.otb_rooms_1d_ago));
  }, 0);

  const shortHtml = `<div style="font-family:Georgia,serif;color:#1a1a1a">
    <h2 style="margin:0 0 4px">${propLabel} · Day report</h2>
    <p style="margin:0 0 16px;color:#5a5a5a">Generated ${todayIso} · Lighthouse snapshot ${snapshotDate ?? 'pending'} · full CSV attached (365 nights)</p>
    ${body.note ? `<p style="background:#fafaf7;padding:10px;border-left:3px solid #084838;margin-bottom:16px">${body.note}</p>` : ''}
    <h3 style="margin:0 0 8px;color:#0B3B2E;font-size:14px">Next 14 nights</h3>
    <table style="border-collapse:collapse;font-size:12px;width:100%;max-width:520px" cellpadding="6" cellspacing="0">
      <tr><td style="color:#5A5A5A">Occupancy</td><td style="text-align:right;font-weight:700">${occ14}%</td></tr>
      <tr style="background:#F8F5EA"><td style="color:#5A5A5A">Room nights</td><td style="text-align:right;font-weight:700">${totRN14}</td></tr>
      <tr><td style="color:#5A5A5A">ADR</td><td style="text-align:right;font-weight:700">${sym}${adr14}</td></tr>
      <tr style="background:#F8F5EA"><td style="color:#5A5A5A">Room revenue</td><td style="text-align:right;font-weight:700">${sym}${Math.round(totRev14).toLocaleString('en-US')}</td></tr>
      <tr><td style="color:#5A5A5A">Pickup last 24h · RN</td><td style="text-align:right;font-weight:700;color:${puTot14 > 0 ? '#0B3B2E' : '#5A5A5A'}">${puTot14 > 0 ? `+${puTot14}` : puTot14}</td></tr>
    </table>
    <p style="font-size:11px;color:#8A8A8A;margin-top:18px">Full 365-night grid — Demand · OCC · OTB · ADR · Room rev · Pickup -1d · Pickup -7d — attached as CSV.</p>
  </div>`;

  // Build FULL CSV attachment (365 nights).
  const lines: string[] = [];
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
  for (const r of paceAll) {
    const p = puMap.get(r.stay_date);
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
  const csv = '﻿' + lines.join('\r\n');
  const csvBase64 = Buffer.from(csv, 'utf8').toString('base64');
  const csvFilename = `day-report-${propLabel.toLowerCase().replace(/\s+/g, '-')}-${todayIso}.csv`;

  const edge = await sb.functions.invoke('send-report-email', {
    body: {
      to,
      subject: `${propLabel} · Day report · ${todayIso}`,
      html: shortHtml,
      from_label: `${propLabel} · Revenue`,
      attachments: [{
        filename: csvFilename,
        content: csvBase64,
        content_type: 'text/csv',
      }],
    },
  });
  if (edge.error) return NextResponse.json({ ok: false, error: edge.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sent_to: to, attached: csvFilename });
}
