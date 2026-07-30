// app/api/compiler/runs/[id]/pdf/route.ts
//
// Brief autospec-compiler_module-20260725 · A3 / D2 (2026-07-30).
// The render route has promised this URL since v1 — it 404'd until now.
// GET ?variant=<variant_id> → print-optimized, server-rendered offer
// document (self-contained HTML, @media print, design tokens). No Puppeteer,
// no new npm dependency (DEPENDENCY LAW): "Print / Save as PDF" in the
// browser produces the binary PDF. Layout reference: the intake mockup
// public/mockups/autospec-compiler_module-20260725.html.
//
// All content is REAL: run + variants from compiler.*, validity window from
// the published retreat when one exists, itinerary from the locked variant's
// day_structure, inclusions from its bookable_* arrays.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function usd(n: unknown): string {
  const v = Number(n);
  return Number.isFinite(v) ? `$${Math.round(v).toLocaleString('en-US')}` : '—';
}

function titleCase(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface DayEntry {
  day?: number;
  title?: string;
  am?: string[]; pm?: string[]; eve?: string[];
  morning?: string; afternoon?: string; evening?: string;
}

function dayLines(d: DayEntry): { slot: string; text: string }[] {
  const lines: { slot: string; text: string }[] = [];
  const push = (slot: string, v: unknown) => {
    if (Array.isArray(v)) v.forEach((x) => x && lines.push({ slot, text: String(x) }));
    else if (v) lines.push({ slot, text: String(v) });
  };
  push('Morning', d.am ?? d.morning);
  push('Afternoon', d.pm ?? d.afternoon);
  push('Evening', d.eve ?? d.evening);
  return lines;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = getSupabaseAdmin();
  const id = params.id;
  const variantParam = req.nextUrl.searchParams.get('variant');

  const [{ data: run }, { data: variants }, { data: retreats }] = await Promise.all([
    admin.schema('compiler').from('runs').select('*').eq('id', id).maybeSingle(),
    admin.schema('compiler').from('variants').select('*').eq('run_id', id).order('label'),
    admin.from('v_retreats').select('*').eq('run_id', id).limit(1),
  ]);
  if (!run) return NextResponse.json({ error: 'run not found' }, { status: 404 });

  const list = (variants ?? []) as any[];
  if (list.length === 0) {
    return NextResponse.json({ error: 'no priced variants yet — build variants first' }, { status: 404 });
  }
  const selected =
    (variantParam && list.find((v) => v.id === variantParam)) ||
    list.find((v) => v.recommended) || list[0];
  const retreat = (retreats ?? [])[0] as any | undefined;

  const spec = (run.parsed_spec ?? {}) as any;
  const nights = spec.duration_nights ?? selected.day_structure?.length ?? '—';
  const pax = spec.pax ?? retreat?.spots_total ?? '—';
  const name = retreat?.name ?? `${titleCase(String(spec.theme ?? 'retreat'))} Retreat · ${nights} nights`;
  const tagline = retreat?.tagline ?? `${nights} nights · ${pax} guests · ${selected.room_category ?? ''}`.trim();
  const validity = retreat
    ? `Valid ${retreat.arrival_window_from ?? '—'} → ${retreat.arrival_window_to ?? '—'}`
    : `Draft offer · not yet published`;

  const days: DayEntry[] = Array.isArray(selected.day_structure) ? selected.day_structure : [];

  const inclusions: string[] = [];
  for (const b of selected.bookable_rooms ?? []) {
    if (b?.name) inclusions.push(`${nights} nights · ${b.name}`);
  }
  for (const b of selected.bookable_boards ?? []) {
    if (b?.mode) inclusions.push(`${b.mode === 'FB' ? 'Full board' : b.mode === 'HB' ? 'Half board' : 'Bed & breakfast'} dining`);
  }
  for (const p of selected.bookable_program ?? []) {
    if (p?.name) inclusions.push(String(p.name));
  }
  inclusions.push('Return airport transfers', 'Welcome ritual · personal concierge');

  const priceCards = list.map((v) => `
      <div class="price-card${v.id === selected.id ? ' sel' : ''}">
        <div class="room">${esc(v.label)}${v.room_category ? ` · ${esc(v.room_category)}` : ''}</div>
        <div class="amount">${usd(v.per_pax_usd)}</div>
        <div class="per">per guest · total ${usd(v.total_usd)}</div>
        ${v.recommended ? '<span class="badge">Recommended</span>' : ''}
      </div>`).join('');

  const dayBlocks = days.map((d, i) => {
    const lines = dayLines(d);
    return `
      <div class="day">
        <div class="n">Day ${esc(d.day ?? i + 1)}</div>
        <div>
          <h3>${esc(d.title ?? `Day ${d.day ?? i + 1}`)}</h3>
          ${lines.map((l) => `<p><strong>${esc(l.slot)}</strong> — ${esc(l.text)}</p>`).join('')}
        </div>
      </div>`;
  }).join('');

  const funnelUrl = retreat ? `/r/${retreat.slug}` : null;
  const generatedAt = new Date().toISOString().slice(0, 10);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(name)} — The Namkhan</title>
<style>
  :root{
    --bg:#F4EFE2; --primary:#1F3A2E; --sand:#B8A878; --terracotta:#B8542A;
    --ink:#1F3A2E; --muted:#5c6f64; --card:#ffffff;
  }
  *{box-sizing:border-box; margin:0; padding:0;}
  body{background:var(--bg); color:var(--ink); font-family:Georgia,'Times New Roman',serif; line-height:1.55;}
  .toolbar{display:flex; justify-content:flex-end; gap:8px; max-width:820px; margin:12px auto 0; padding:0 16px; font-family:Arial,sans-serif;}
  .toolbar button,.toolbar a{background:var(--primary); color:#fff; border:none; border-radius:6px; padding:8px 14px; font-size:13px; cursor:pointer; text-decoration:none;}
  .toolbar a.alt{background:transparent; color:var(--primary); border:1px solid var(--primary);}
  .doc{max-width:820px; margin:12px auto 48px; background:var(--card); box-shadow:0 2px 14px rgba(31,58,46,.12);}
  .hero{background:linear-gradient(160deg, #1F3A2E 0%, #2c5242 70%); color:#F4EFE2; padding:56px 56px 40px;}
  .hero .kicker{font-family:Arial,sans-serif; font-size:11px; letter-spacing:.28em; text-transform:uppercase; color:var(--sand); margin-bottom:14px;}
  .hero h1{font-size:34px; font-weight:normal; letter-spacing:.01em; margin-bottom:10px;}
  .hero .sub{font-size:16px; color:#e9e2cd; max-width:520px;}
  .hero .validity{margin-top:22px; display:inline-block; border:1px solid var(--sand); color:var(--sand); font-family:Arial,sans-serif; font-size:12px; letter-spacing:.08em; padding:6px 12px; border-radius:999px;}
  section{padding:36px 56px; border-bottom:1px solid #eee7d6;}
  h2{font-family:Arial,sans-serif; font-size:12px; letter-spacing:.24em; text-transform:uppercase; color:var(--terracotta); margin-bottom:18px;}
  .price-grid{display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px;}
  .price-card{border:1px solid #e4dcc6; border-radius:10px; padding:18px;}
  .price-card.sel{border-color:var(--primary); box-shadow:0 0 0 2px var(--primary) inset;}
  .price-card .room{font-family:Arial,sans-serif; font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:6px;}
  .price-card .amount{font-size:26px; color:var(--primary);}
  .price-card .per{font-size:12px; color:var(--muted); font-family:Arial,sans-serif;}
  .price-card .badge{display:inline-block; margin-top:8px; background:var(--sand); color:#fff; font-family:Arial,sans-serif; font-size:10px; letter-spacing:.08em; text-transform:uppercase; padding:3px 8px; border-radius:4px;}
  .day{display:flex; gap:18px; padding:14px 0; border-bottom:1px dashed #e4dcc6;}
  .day:last-child{border-bottom:none;}
  .day .n{flex:0 0 64px; font-family:Arial,sans-serif; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--sand); padding-top:4px;}
  .day h3{font-size:17px; font-weight:normal; margin-bottom:4px;}
  .day p{font-size:14px; color:var(--muted);}
  .inclusions ul{list-style:none; columns:2; column-gap:32px;}
  .inclusions li{font-size:14px; padding:6px 0 6px 22px; position:relative; break-inside:avoid;}
  .inclusions li::before{content:''; position:absolute; left:0; top:13px; width:10px; height:10px; border-radius:50%; background:var(--sand);}
  .contact{display:flex; justify-content:space-between; align-items:center; gap:24px; flex-wrap:wrap;}
  .contact .cta{background:var(--terracotta); color:#fff; font-family:Arial,sans-serif; font-size:14px; letter-spacing:.05em; text-decoration:none; padding:12px 26px; border-radius:6px;}
  .contact .meta{font-size:13px; color:var(--muted); font-family:Arial,sans-serif;}
  .footer{padding:20px 56px; font-family:Arial,sans-serif; font-size:11px; color:var(--muted); display:flex; justify-content:space-between;}
  @media print{
    .toolbar{display:none;}
    body{background:#fff;}
    .doc{box-shadow:none; margin:0; max-width:none;}
    .hero{-webkit-print-color-adjust:exact; print-color-adjust:exact;}
    section{page-break-inside:avoid;}
  }
  @media (max-width:640px){ .price-grid{grid-template-columns:1fr;} section,.hero{padding-left:24px;padding-right:24px;} }
</style>
</head>
<body>
<div class="toolbar">
  ${funnelUrl ? `<a class="alt" href="${esc(funnelUrl)}">Open booking page</a>` : ''}
  <button onclick="window.print()">Print / Save as PDF</button>
</div>
<div class="doc">
  <div class="hero">
    <div class="kicker">The Namkhan · Luang Prabang · Laos</div>
    <h1>${esc(name)}</h1>
    <div class="sub">${esc(tagline)}</div>
    <div class="validity">${esc(validity)}</div>
  </div>
  <section>
    <h2>Investment · per guest</h2>
    <div class="price-grid">${priceCards}</div>
  </section>
  ${dayBlocks ? `<section><h2>Itinerary · day by day</h2>${dayBlocks}</section>` : ''}
  <section class="inclusions">
    <h2>Included</h2>
    <ul>${inclusions.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
  </section>
  <section class="contact">
    ${funnelUrl
      ? `<a class="cta" href="${esc(funnelUrl)}">Reserve your spot</a>`
      : `<span class="cta" style="opacity:.55">Booking opens on publish</span>`}
    <div class="meta">book@thenamkhan.com · +856 71 260 777 · thenamkhan.com</div>
  </section>
  <div class="footer">
    <span>The Namkhan · offer document</span>
    <span>${esc(selected.label)} · generated ${generatedAt}</span>
  </div>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
