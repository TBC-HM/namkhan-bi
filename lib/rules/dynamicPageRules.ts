// lib/rules/dynamicPageRules.ts
// PBS 2026-07-17 — page-scoped guardrail evaluators for the NEW rules seeded
// on 2026-07-17. Each function does its own data loading + rule eval and
// returns Insight[]. Called from evaluateForBriefings. No fake wiring —
// every rule reads live views.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { Insight } from '@/app/_components/ConclusionBlock';

// Effective threshold lookup — uses monthly override if available.
async function effTh(sb: ReturnType<typeof getSupabaseAdmin>, propertyId: number, rule_key: string, month?: number): Promise<number | null> {
  const { data, error } = await sb.rpc('fn_guardrail_effective_threshold', {
    p_property_id: propertyId, p_rule_key: rule_key, p_month: month ?? null,
  });
  if (error || data == null) return null;
  return Number(data);
}

function iso(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(base: Date, n: number) { const x = new Date(base.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; }
function shiftYear(dateIso: string, delta: number): string {
  const d = new Date(dateIso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + delta);
  return d.toISOString().slice(0, 10);
}

export async function evaluateDynamicPageRules(propertyId: number): Promise<Insight[]> {
  const sb = getSupabaseAdmin();
  const out: Insight[] = [];
  const today = new Date();
  const todayIso = iso(today);
  const yesterdayIso = iso(addDays(today, -1));
  const in90Iso = iso(addDays(today, 90));
  const lyFromIso = shiftYear(todayIso, -1);
  const lyToIso   = shiftYear(in90Iso, -1);
  const currentMonth = today.getUTCMonth() + 1;

  // ── Load everything in parallel ───────────────────────────────────
  const [
    hodActYestRes,
    paceRes,
    stlyRes,
    parityMatrixRes,
    countryLeadRes,
    countryLeadLyRes,
    countryHeatmapRes,
  ] = await Promise.all([
    sb.rpc('fn_hod_day_activity', { p_property_id: propertyId, p_anchor: yesterdayIso }),
    sb.from('v_otb_pace').select('night_date, confirmed_rooms').eq('property_id', propertyId).gte('night_date', todayIso).lte('night_date', in90Iso).order('night_date'),
    sb.from('mv_kpi_daily').select('night_date, rooms_sold').eq('property_id', propertyId).gte('night_date', lyFromIso).lte('night_date', lyToIso),
    sb.from('v_parity_matrix_pb').select('stay_date, pct_vs_cheapest_comp, num_comps_undercutting, comps_with_price').eq('property_id', propertyId).gte('stay_date', todayIso).lte('stay_date', in90Iso).order('stay_date'),
    // Current-year country × lead-bucket distribution
    sb.from('v_country_lead_time_distribution').select('guest_country_iso2, lead_bucket, bookings, room_nights, revenue').eq('property_id', propertyId),
    // LY same window (approximation — no year filter available, so use ly_bookings on heatmap for the comparison instead)
    Promise.resolve({ data: null, error: null }),
    // 12-month country × stay-month heatmap with TY + LY
    sb.from('v_country_stay_month_heatmap').select('guest_country_iso2, stay_month, bookings, room_nights, revenue, adr, ly_bookings, ly_room_nights, ly_revenue, ly_adr').eq('property_id', propertyId),
  ]);

  // ── HoD · pickup missed yesterday ────────────────────────────────
  {
    const yPickup = Number((((hodActYestRes.data ?? []) as Array<{ pickup_net_rn: number|string }>)[0]?.pickup_net_rn) ?? 0);
    const target = (await effTh(sb, propertyId, 'pickup_min_daily', currentMonth)) ?? 0;
    if (target > 0 && yPickup < target) {
      out.push({
        key: 'hod_pickup_missed_yesterday',
        priority: 'warning',
        title: `Yesterday pickup ${yPickup} RN — below target ${target}`,
        body: `Yesterday's net pickup came in at ${yPickup} room-nights, target is ${target}. Look at Pickup page for which sources dried up.`,
        action: 'Open Pickup', href: '/revenue/pickup',
      });
    }
  }

  // ── Compute per-night pace (TY vs LY) ────────────────────────────
  const stlyMap = new Map<string, number>();
  for (const r of ((stlyRes.data ?? []) as Array<{ night_date: string; rooms_sold: number|null }>)) {
    stlyMap.set(String(r.night_date), Number(r.rooms_sold ?? 0));
  }
  const paceRows = ((paceRes.data ?? []) as Array<{ night_date: string; confirmed_rooms: number|null }>).map((r) => {
    const rooms = Number(r.confirmed_rooms ?? 0);
    const lyRooms = stlyMap.get(shiftYear(r.night_date, -1)) ?? null;
    return { night_date: r.night_date, rooms, lyRooms };
  });

  // ── Pulse · low OCC cluster next 14d (3+ consecutive nights below X%) ──
  {
    const CAPACITY = 30;
    const threshold = (await effTh(sb, propertyId, 'pulse_low_occ_cluster_next14')) ?? 25;
    const first14 = paceRows.slice(0, 14).map((r) => ({ ...r, occ: CAPACITY > 0 ? (r.rooms / CAPACITY) * 100 : 0 }));
    let run: typeof first14 = [];
    const clusters: Array<{ from: string; to: string; nights: number; avgOcc: number }> = [];
    for (const n of first14) {
      if (n.occ < threshold) {
        run.push(n);
      } else {
        if (run.length >= 3) clusters.push({ from: run[0].night_date, to: run[run.length-1].night_date, nights: run.length, avgOcc: run.reduce((s, r) => s + r.occ, 0) / run.length });
        run = [];
      }
    }
    if (run.length >= 3) clusters.push({ from: run[0].night_date, to: run[run.length-1].night_date, nights: run.length, avgOcc: run.reduce((s, r) => s + r.occ, 0) / run.length });
    for (const c of clusters) {
      out.push({
        key: `pulse_low_occ_cluster_next14:${c.from}`,
        priority: 'warning',
        title: `${c.nights} soft nights ${c.from} → ${c.to} · avg ${c.avgOcc.toFixed(1)}% OCC`,
        body: `${c.nights} consecutive nights forecast below ${threshold}% OCC. Consider short-notice promo, Genius push, or package.`,
        action: 'Open Pulse', href: '/revenue/pulse',
      });
    }
  }

  // ── Pace · behind 60d out AND ahead 30d out (per calendar month) ─
  {
    // Bucket paceRows into calendar months
    const monthly = new Map<string, { tyRn: number; lyRn: number; nights: number }>();
    for (const r of paceRows) {
      const ym = r.night_date.slice(0, 7);
      const b = monthly.get(ym) ?? { tyRn: 0, lyRn: 0, nights: 0 };
      b.tyRn += r.rooms;
      b.lyRn += r.lyRooms ?? 0;
      b.nights += 1;
      monthly.set(ym, b);
    }
    const CAPACITY = 30;
    // M+2 = second future month
    const now = new Date();
    const m1 = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    const m2 = new Date(now.getUTCFullYear(), now.getUTCMonth() + 2, 1);
    const m1Ym = `${m1.getUTCFullYear()}-${String(m1.getUTCMonth() + 1).padStart(2, '0')}`;
    const m2Ym = `${m2.getUTCFullYear()}-${String(m2.getUTCMonth() + 1).padStart(2, '0')}`;
    const thBehind = (await effTh(sb, propertyId, 'pace_behind_60d_out')) ?? 15;
    const thAhead  = (await effTh(sb, propertyId, 'pace_ahead_30d_out'))  ?? 15;
    const b2 = monthly.get(m2Ym);
    if (b2 && b2.nights > 0) {
      const tyOcc = (b2.tyRn / (CAPACITY * b2.nights)) * 100;
      const lyOcc = b2.lyRn === 0 ? 0 : (b2.lyRn / (CAPACITY * b2.nights)) * 100;
      const gapPp = tyOcc - lyOcc;
      if (b2.lyRn > 0 && gapPp <= -thBehind) {
        out.push({
          key: `pace_behind_60d_out:${m2Ym}`,
          priority: 'critical',
          title: `${m2Ym} pace ${gapPp.toFixed(1)}pp behind SDLY — inject demand now`,
          body: `Month ${m2Ym} is tracking ${gapPp.toFixed(1)}pp OCC behind same-time-last-year (${tyOcc.toFixed(1)}% vs ${lyOcc.toFixed(1)}%). Threshold ${thBehind}pp. Consider mass promos + country campaigns for ${m2Ym}.`,
          action: 'Open Pace', href: '/revenue/pace',
        });
      }
    }
    const b1 = monthly.get(m1Ym);
    if (b1 && b1.nights > 0) {
      const tyOcc = (b1.tyRn / (CAPACITY * b1.nights)) * 100;
      const lyOcc = b1.lyRn === 0 ? 0 : (b1.lyRn / (CAPACITY * b1.nights)) * 100;
      const gapPp = tyOcc - lyOcc;
      if (b1.lyRn > 0 && gapPp >= thAhead) {
        out.push({
          key: `pace_ahead_30d_out:${m1Ym}`,
          priority: 'positive',
          title: `${m1Ym} pace +${gapPp.toFixed(1)}pp ahead SDLY — tighten BAR + remove promos`,
          body: `Month ${m1Ym} is tracking ${gapPp.toFixed(1)}pp OCC ahead of same-time-last-year (${tyOcc.toFixed(1)}% vs ${lyOcc.toFixed(1)}%). Threshold ${thAhead}pp. Raise BAR and cull discounts for ${m1Ym}.`,
          action: 'Open Pricing', href: '/revenue/pricing',
        });
      }
    }
  }

  // ── Compset · we cheapest AND stay-date OCC < threshold ─────────
  {
    const threshold = (await effTh(sb, propertyId, 'compset_we_cheapest_not_soldout')) ?? 60;
    const CAPACITY = 30;
    const occByDate = new Map<string, number>();
    for (const r of paceRows) occByDate.set(r.night_date, CAPACITY > 0 ? (r.rooms / CAPACITY) * 100 : 0);
    type CmRow = { stay_date: string; pct_vs_cheapest_comp: number|string|null; num_comps_undercutting: number|null; comps_with_price: number|null };
    const cheapestDates: string[] = [];
    for (const r of ((parityMatrixRes.data ?? []) as CmRow[])) {
      const pct = r.pct_vs_cheapest_comp == null ? null : Number(r.pct_vs_cheapest_comp);
      // pct_vs_cheapest_comp: positive = we sit above cheapest comp; <=0 = we ARE cheapest (or tied)
      if (pct != null && pct <= 0 && (r.comps_with_price ?? 0) >= 3) {
        const occ = occByDate.get(r.stay_date) ?? 0;
        if (occ < threshold) cheapestDates.push(r.stay_date);
      }
    }
    if (cheapestDates.length > 0) {
      out.push({
        key: 'compset_we_cheapest_not_soldout',
        priority: 'warning',
        title: `${cheapestDates.length} stay-dates: we're cheapest in compset AND OCC < ${threshold}%`,
        body: `Sample dates: ${cheapestDates.slice(0, 6).join(', ')}${cheapestDates.length > 6 ? '…' : ''}. Money on the table — raise BAR for these dates.`,
        action: 'Open Compset', href: '/revenue/compset',
      });
    }
  }

  // ── Markets · early-bird window closing per country ──────────────
  // Uses v_country_stay_month_heatmap: compare TY vs LY room_nights per country for months 2-3 out (early-bird window).
  {
    type HmRow = { guest_country_iso2: string; stay_month: string; room_nights: number|null; ly_room_nights: number|null; revenue: number|null; ly_revenue: number|null; adr: number|null; ly_adr: number|null; bookings: number|null; ly_bookings: number|null };
    const hmRows = ((countryHeatmapRes.data ?? []) as HmRow[]);
    // Focus 60-90 day-out ≈ months m+2 and m+3
    const now = new Date();
    const m2 = new Date(now.getUTCFullYear(), now.getUTCMonth() + 2, 1);
    const m3 = new Date(now.getUTCFullYear(), now.getUTCMonth() + 3, 1);
    const focusMonths = [
      `${m2.getUTCFullYear()}-${String(m2.getUTCMonth() + 1).padStart(2, '0')}`,
      `${m3.getUTCFullYear()}-${String(m3.getUTCMonth() + 1).padStart(2, '0')}`,
    ];
    const thPct = (await effTh(sb, propertyId, 'markets_country_early_bird_closing')) ?? 30;
    // Aggregate by country over focus months
    const perCountry = new Map<string, { ty: number; ly: number; rev: number; lyRev: number }>();
    for (const r of hmRows) {
      const ym = r.stay_month.slice(0, 7);
      if (!focusMonths.includes(ym)) continue;
      const c = (r.guest_country_iso2 ?? '').trim();
      if (!c) continue;
      const b = perCountry.get(c) ?? { ty: 0, ly: 0, rev: 0, lyRev: 0 };
      b.ty += Number(r.room_nights ?? 0);
      b.ly += Number(r.ly_room_nights ?? 0);
      b.rev += Number(r.revenue ?? 0);
      b.lyRev += Number(r.ly_revenue ?? 0);
      perCountry.set(c, b);
    }
    for (const [country, b] of perCountry.entries()) {
      if (b.ly < 5) continue; // ignore tiny markets
      const dropPct = b.ly === 0 ? 0 : ((b.ly - b.ty) / b.ly) * 100;
      if (dropPct >= thPct) {
        out.push({
          key: `markets_country_early_bird_closing:${country}`,
          priority: 'warning',
          title: `${country} early-bird window closing · pickup ${dropPct.toFixed(0)}% below LY for M+2/M+3`,
          body: `${country}: ${b.ty} TY RN vs ${b.ly} LY RN in ${focusMonths.join(' + ')} (${dropPct.toFixed(0)}% below LY). Run 45-day early-bird promo targeting ${country}.`,
          action: 'Open Markets', href: '/revenue/markets',
        });
      }
    }
  }

  // ── Markets · demand surge per country (next-12mo aggregate) ────
  {
    type HmRow = { guest_country_iso2: string; stay_month: string; room_nights: number|null; ly_room_nights: number|null };
    const hmRows = ((countryHeatmapRes.data ?? []) as HmRow[]);
    const thPct = (await effTh(sb, propertyId, 'markets_country_demand_surge')) ?? 50;
    const perCountry = new Map<string, { ty: number; ly: number }>();
    // Sum over all forward stay-months (next 12)
    const cutoff = iso(addDays(today, 365));
    for (const r of hmRows) {
      const ym = r.stay_month.slice(0, 7);
      if (ym < todayIso.slice(0, 7)) continue;
      if (ym > cutoff.slice(0, 7)) continue;
      const c = (r.guest_country_iso2 ?? '').trim();
      if (!c) continue;
      const b = perCountry.get(c) ?? { ty: 0, ly: 0 };
      b.ty += Number(r.room_nights ?? 0);
      b.ly += Number(r.ly_room_nights ?? 0);
      perCountry.set(c, b);
    }
    for (const [country, b] of perCountry.entries()) {
      if (b.ly < 10) continue;
      const surgePct = b.ly === 0 ? 0 : ((b.ty - b.ly) / b.ly) * 100;
      if (surgePct >= thPct) {
        out.push({
          key: `markets_country_demand_surge:${country}`,
          priority: 'positive',
          title: `${country} demand +${surgePct.toFixed(0)}% vs LY (next 12mo)`,
          body: `${country}: ${b.ty} TY RN vs ${b.ly} LY RN forward-book. Consider tightening country-${country} promos and adding a dedicated ${country} campaign.`,
          action: 'Open Markets', href: '/revenue/markets',
        });
      }
    }
  }

  // ── Markets · new-market signal (country with L30 pickup + not in L365 top-20) ─
  // Approximation using v_country_market_summary → identify low-history high-momentum markets.
  {
    const { data: sumData } = await sb.from('v_country_market_summary')
      .select('guest_country_iso2, bookings, ly12_bookings, revenue')
      .eq('property_id', propertyId);
    type S = { guest_country_iso2: string; bookings: number|null; ly12_bookings: number|null; revenue: number|null };
    const rows = ((sumData ?? []) as S[]).filter(r => (r.guest_country_iso2 ?? '').trim());
    // Rank by ly12_bookings — top 20 = established markets
    const top20 = new Set(
      [...rows].sort((a, b) => (Number(b.ly12_bookings ?? 0)) - (Number(a.ly12_bookings ?? 0))).slice(0, 20)
        .map(r => (r.guest_country_iso2 ?? '').trim())
    );
    const th = (await effTh(sb, propertyId, 'markets_country_new_market_signal')) ?? 5;
    for (const r of rows) {
      const c = (r.guest_country_iso2 ?? '').trim();
      if (!c) continue;
      if (top20.has(c)) continue;
      const bk = Number(r.bookings ?? 0);
      if (bk >= th) {
        out.push({
          key: `markets_country_new_market_signal:${c}`,
          priority: 'info',
          title: `${c}: ${bk} bookings — new market signal`,
          body: `${c} shows ${bk} recent bookings but sits outside L12-month top-20 (${Number(r.ly12_bookings ?? 0)} LY). Consider a dedicated ${c} campaign.`,
          action: 'Open Markets', href: '/revenue/markets',
        });
      }
    }
  }

  return out;
}
