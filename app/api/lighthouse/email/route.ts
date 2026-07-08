// app/api/lighthouse/email/route.ts
// PBS 2026-07-08: send SHORT compset summary in body + attach FULL CSV.

import { NextResponse } from 'next/server';
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Req { to: string; note?: string; property_id?: number }

const q = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const round0 = (n: number | null | undefined) => (n == null || !Number.isFinite(n)) ? '' : String(Math.round(n));
const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] as string));

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
  const sym = cur === 'EUR' ? '€' : '$';
  const todayIso = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);

  const sb = getSupabaseAdmin();
  const { data: latestSnap } = await sb.from('v_lighthouse_rateshop')
    .select('shop_date').eq('property_id', pid).order('shop_date', { ascending: false }).limit(1);
  const snapshotDate = latestSnap?.[0]?.shop_date ?? null;
  if (!snapshotDate) {
    return NextResponse.json({ ok: false, error: 'no_snapshot' }, { status: 400 });
  }

  const { data: rows } = await sb.from('v_lighthouse_rateshop')
    .select('stay_date, hotel_name, is_self, bar_rate, rate_status_raw, median_compset, compset_rank, ota_ranking, market_demand, holidays, events')
    .eq('property_id', pid).eq('shop_date', snapshotDate)
    .order('stay_date').order('is_self', { ascending: false }).order('hotel_name');

  const all = (rows ?? []) as any[];
  const dates = Array.from(new Set(all.map(r => r.stay_date))).sort();

  // Short summary — next 14 nights, own vs median compset
  const rowsHtml = dates.filter(d => d <= in14).map((d) => {
    const own = all.find(r => r.stay_date === d && r.is_self);
    const ownRate = own?.bar_rate != null ? Math.round(Number(own.bar_rate)) : null;
    const ownRestr = own?.rate_status_raw ?? null;
    const median = own?.median_compset != null ? Math.round(Number(own.median_compset)) : null;
    const rank = own?.compset_rank ?? '';
    const demand = own?.market_demand != null ? `${Math.round(Number(own.market_demand) * 100)}%` : '';
    const bookingRank = own?.ota_ranking ?? '';
    const holidays = own?.holidays ?? '';
    const ownCell = ownRate !== null ? `${sym}${ownRate}` : (ownRestr ? esc(ownRestr) : '—');
    const medCell = median !== null ? `${sym}${median}` : '—';
    return `<tr><td>${d}</td><td style="text-align:right;font-weight:600">${ownCell}</td><td style="text-align:right">${medCell}</td><td>${esc(rank)}</td><td>${demand}</td><td>${esc(bookingRank)}</td><td style="color:${holidays ? '#B04A2F' : '#B0B0B0'}">${esc(holidays)}</td></tr>`;
  }).join('');

  const shortHtml = `<div style="font-family:Georgia,serif;color:#1a1a1a">
    <h2 style="margin:0 0 4px">${propLabel} · Lighthouse compset</h2>
    <p style="margin:0 0 16px;color:#5a5a5a">Snapshot ${snapshotDate} · Next 14 nights below · full grid (${dates.length} dates × ${new Set(all.map(r => r.hotel_name)).size} hotels) attached as CSV</p>
    ${body.note ? `<p style="background:#fafaf7;padding:10px;border-left:3px solid #084838;margin-bottom:16px">${esc(body.note)}</p>` : ''}
    <table style="border-collapse:collapse;font-size:12px;width:100%" cellpadding="6" cellspacing="0">
      <thead style="background:#F8F5EA;color:#5C5F61;text-transform:uppercase;letter-spacing:0.04em;font-size:10px">
        <tr><th style="text-align:left">Date</th><th style="text-align:right">Own</th><th style="text-align:right">Median compset</th><th style="text-align:left">Rank</th><th style="text-align:left">Demand</th><th style="text-align:left">BCom rank</th><th style="text-align:left">Holidays</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="font-size:11px;color:#8A8A8A;margin-top:14px">CSV attachment: one row per (stay date × hotel) with rate, restriction, median compset, ranking, demand, and events.</p>
  </div>`;

  // Full CSV
  const lines: string[] = [];
  lines.push(q(`Lighthouse compset · ${propLabel} · Generated ${todayIso}`));
  lines.push(q(`Property ID ${pid} · Snapshot date ${snapshotDate} · Currency ${cur}`));
  lines.push('');
  lines.push([
    'Stay date','Hotel','Is own','Rate','Restriction',
    'Median compset','Compset rank','Booking.com ranking','Market demand %',
    'Holidays','Events',
  ].map(q).join(','));
  for (const r of all) {
    const demand = r.market_demand != null ? `${Math.round(Number(r.market_demand) * 100)}%` : '';
    lines.push([
      r.stay_date, r.hotel_name, r.is_self ? 'yes' : '',
      round0(r.bar_rate), r.rate_status_raw ?? '',
      round0(r.median_compset), r.compset_rank ?? '',
      r.ota_ranking ?? '', demand,
      r.holidays ?? '', r.events ?? '',
    ].map(q).join(','));
  }
  const csv = '﻿' + lines.join('\r\n');
  const csvBase64 = Buffer.from(csv, 'utf8').toString('base64');
  const csvFilename = `lighthouse-${propLabel.toLowerCase().replace(/\s+/g, '-')}-${snapshotDate}.csv`;

  const edge = await sb.functions.invoke('send-report-email', {
    body: {
      to,
      subject: `${propLabel} · Lighthouse compset · ${snapshotDate}`,
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
