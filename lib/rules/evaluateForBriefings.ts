// lib/rules/evaluateForBriefings.ts
// PBS 2026-07-17 — dynamic evaluator for /revenue/briefing.
// Loads live context for ONE property, invokes the same evaluators the HoD
// Conclusion Block uses (evaluateRevenueRules · evaluateParityRules · runRatePlanRules),
// and returns the resulting Insight[] ready to upsert into briefing.items.
//
// This helper is the SINGLE SOURCE for guardrail firings. Both the daily cron
// (/api/cron/briefing-evaluate) and the manual "Refresh" button on
// /revenue/briefing call this. No mocks, no hardcoded rules — everything derives
// from public.guardrails + live KPI views.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  evaluateRevenueRules,
  type RevenueContext, type RevenueTargets,
  type PaceNight, type CountryPickup,
} from '@/lib/rules/revenue';
import { evaluateParityRules, type ParityContext, type ParityTargets } from '@/lib/rules/parity';
import { runRatePlanRules, type RatePlanContext, type RatePlanTargets } from '@/lib/rules/rateplans';
import type { Insight } from '@/app/_components/ConclusionBlock';

const CAPACITY = 30;

function shiftYearIso(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + delta);
  return d.toISOString().slice(0, 10);
}

export async function evaluateForBriefings(propertyId: number): Promise<Insight[]> {
  const sb = getSupabaseAdmin();
  const PROPERTY_TZ = propertyId === 1000001 ? 'Europe/Madrid' : 'Asia/Vientiane';
  const isoInTz = (d: Date, tz: string): string => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}-${parts.find(p=>p.type==='day')!.value}`;
  };
  const todayIso = isoInTz(new Date(), PROPERTY_TZ);
  const in30Iso = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const in90Iso = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);
  const lyFromIso = shiftYearIso(todayIso, -1);
  const lyToIso   = shiftYearIso(in90Iso, -1);
  const l14FromIso   = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  const l14FromLyIso = shiftYearIso(l14FromIso, -1);
  const l14ToLyIso   = shiftYearIso(todayIso, -1);

  const symToday = propertyId === 1000001 ? '€' : '$';

  const [
    todayKpiRes, guardrailsRes,
    paceRes, stlyRes,
    l14PickupRes, l14LyPickupRes,
    next30ArrivalsRes,
    integrityRes, lighthouseLatestRes,
    parityMatrixRes, compsetHistoryRes,
    ratePlanHygieneRes,
  ] = await Promise.all([
    sb.rpc('fn_revenue_hod_today_kpi', { p_property_id: propertyId }),
    sb.from('guardrails').select('rule_key, threshold_val').eq('property_id', propertyId).eq('domain', 'revenue').eq('active', true),
    sb.from('v_otb_pace').select('night_date, confirmed_rooms').eq('property_id', propertyId).gte('night_date', todayIso).lte('night_date', in90Iso).order('night_date'),
    sb.from('mv_kpi_daily').select('night_date, rooms_sold').eq('property_id', propertyId).gte('night_date', lyFromIso).lte('night_date', lyToIso),
    sb.from('v_reservations_unified').select('reservation_id, booking_date, check_in_date, check_out_date, guest_country_iso2, rate_plan_name').eq('property_id', propertyId).eq('is_cancelled', false).gte('booking_date', l14FromIso).lte('booking_date', todayIso),
    sb.from('v_reservations_unified').select('reservation_id, guest_country_iso2').eq('property_id', propertyId).eq('is_cancelled', false).gte('booking_date', l14FromLyIso).lte('booking_date', l14ToLyIso),
    sb.from('v_reservations_unified').select('reservation_id, check_in_date, check_out_date').eq('property_id', propertyId).eq('is_cancelled', false).gte('check_in_date', todayIso).lte('check_in_date', in30Iso),
    sb.from('v_rate_integrity_matrix').select('shop_date, stay_date, direct_usd, booking_usd, expedia_usd, agoda_usd, tiket_usd, spread_pct, spread_usd, otas_sold_out').eq('property_id', propertyId).order('shop_date', { ascending: false }).order('stay_date', { ascending: true }),
    sb.from('v_lighthouse_rateshop').select('shop_date').eq('property_id', propertyId).order('shop_date', { ascending: false }).limit(1),
    sb.from('v_parity_matrix_pb').select('stay_date, pct_vs_cheapest_comp, num_comps_undercutting, comps_with_price').eq('property_id', propertyId).order('stay_date', { ascending: true }),
    sb.from('v_lighthouse_rateshop').select('shop_date, stay_date, hotel_name, is_self, bar_rate').eq('property_id', propertyId).eq('feed_source', 'compset').gte('shop_date', new Date(Date.now() - 8 * 86400_000).toISOString().slice(0, 10)),
    sb.from('v_rate_plan_hygiene').select('active_plans_total, sleeping_total, sleeping_over_2y, sleeping_1_2y, sleeping_180d_1y, never_booked, never_booked_pct, orphan_count, ytd_revenue_total, nrr_locked_share_pct, flex_share_pct, early_bird_share_pct').eq('property_id', propertyId).maybeSingle().then((r) => r, () => ({ data: null, error: null })),
  ]);

  const todayKpi = ((todayKpiRes.data ?? [])[0] ?? null) as { rn_tonight: number; capacity: number; occ_pct: number; adr_today: number; revpar_today: number } | null;

  // Targets
  const targets: RevenueTargets = {};
  const parityTargets: ParityTargets = {};
  const ratePlanTargets: RatePlanTargets = {};
  for (const g of (guardrailsRes.data ?? []) as Array<{ rule_key: string; threshold_val: number | string }>) {
    const n = typeof g.threshold_val === 'string' ? Number(g.threshold_val) : g.threshold_val;
    if (!Number.isFinite(n)) continue;
    if (g.rule_key === 'occupancy_target') targets.occupancy_target = n;
    else if (g.rule_key === 'adr_target') targets.adr_target = n;
    else if (g.rule_key === 'revpar_target') targets.revpar_target = n;
    else if (g.rule_key === 'pickup_min_daily') targets.pickup_min_daily = n;
    else if (g.rule_key === 'pace_gap_pp') targets.pace_gap_pp = n;
    else if (g.rule_key === 'parity_breach_usd') parityTargets.parity_breach_usd = n;
    else if (g.rule_key === 'integrity_max_spread_pct') parityTargets.integrity_max_spread_pct = n;
    else if (g.rule_key === 'integrity_soldout_days_max') parityTargets.integrity_soldout_days_max = n;
    else if (g.rule_key === 'compset_stale_days') parityTargets.compset_stale_days = n;
    else if (g.rule_key === 'lighthouse_stale_days') parityTargets.lighthouse_stale_days = n;
    else if (g.rule_key === 'compset_undercut_days_pct') parityTargets.compset_undercut_days_pct = n;
    else if (g.rule_key === 'compset_avg_delta_pct') parityTargets.compset_avg_delta_pct = n;
    else if (g.rule_key === 'compset_rate_change_3d_max_pct') parityTargets.compset_rate_change_3d_max_pct = n;
    else if (g.rule_key === 'compset_rate_change_7d_max_pct') parityTargets.compset_rate_change_7d_max_pct = n;
    else if (g.rule_key === 'nrr_share_target') ratePlanTargets.nrr_share_target = n;
    else if (g.rule_key === 'early_bird_share_target') ratePlanTargets.early_bird_share_target = n;
    else if (g.rule_key === 'flex_share_max') ratePlanTargets.flex_share_max = n;
    else if (g.rule_key === 'sleeping_plan_max_days') ratePlanTargets.sleeping_plan_max_days = n;
    else if (g.rule_key === 'never_booked_plan_max_share') ratePlanTargets.never_booked_plan_max_share = n;
    else if (g.rule_key === 'orphan_catalogue_gap_max') ratePlanTargets.orphan_catalogue_gap_max = n;
  }

  // paceNext90
  const stlyMap = new Map<string, number>();
  for (const r of ((stlyRes.data ?? []) as Array<{ night_date: string; rooms_sold: number | null }>)) {
    stlyMap.set(String(r.night_date), Number(r.rooms_sold ?? 0));
  }
  const paceRows = (paceRes.data ?? []) as Array<{ night_date: string; confirmed_rooms: number | null }>;
  const paceNext90: PaceNight[] = paceRows.map((r) => {
    const shifted = shiftYearIso(r.night_date, -1);
    const stly = stlyMap.has(shifted) ? stlyMap.get(shifted)! : null;
    const rooms = Number(r.confirmed_rooms ?? 0);
    const daysOut = Math.max(0, Math.round((new Date(r.night_date).getTime() - Date.now()) / 86400_000));
    return { night_date: r.night_date, daysOut, confirmedRooms: rooms, capacity: CAPACITY, occPct: CAPACITY > 0 ? (rooms / CAPACITY) * 100 : 0, stlyRooms: stly };
  });

  // Country L14 pickup
  const l14Rows = (l14PickupRes.data ?? []) as Array<{ guest_country_iso2: string | null; rate_plan_name: string | null }>;
  const l14LyRows = (l14LyPickupRes.data ?? []) as Array<{ guest_country_iso2: string | null }>;
  const countryL14 = new Map<string, number>();
  const countryL14Ly = new Map<string, number>();
  for (const r of l14Rows) { const c = r.guest_country_iso2 || 'UNK'; countryL14.set(c, (countryL14.get(c) ?? 0) + 1); }
  for (const r of l14LyRows) { const c = r.guest_country_iso2 || 'UNK'; countryL14Ly.set(c, (countryL14Ly.get(c) ?? 0) + 1); }
  const topCountriesL14: CountryPickup[] = Array.from(countryL14.entries())
    .filter(([c]) => c !== 'UNK')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, pickupL14]) => ({ country, pickupL14, pickupLyL14: countryL14Ly.get(country) ?? null }));

  // Rate-plan concentration + LOS
  const rateCounts = new Map<string, number>();
  for (const r of l14Rows) { const name = r.rate_plan_name || 'unknown'; rateCounts.set(name, (rateCounts.get(name) ?? 0) + 1); }
  const totalPickupL14 = l14Rows.length;
  const ratePlanTopSharePct: number | null = totalPickupL14 > 0
    ? (Math.max(0, ...Array.from(rateCounts.values())) / totalPickupL14) * 100 : null;
  const sleepingCount = totalPickupL14 > 0
    ? Array.from(rateCounts.values()).filter(c => c === 0).length : null;

  const next30 = (next30ArrivalsRes.data ?? []) as Array<{ check_in_date: string | null; check_out_date: string | null }>;
  const losValues = next30
    .filter(r => r.check_in_date && r.check_out_date)
    .map(r => Math.max(1, Math.round((new Date(r.check_out_date!).getTime() - new Date(r.check_in_date!).getTime()) / 86400_000)));
  const avgLosNext30 = losValues.length > 0 ? losValues.reduce((s, v) => s + v, 0) / losValues.length : null;

  // Aggregate today's booking activity for pickupCount/Value + cancelCount/Value.
  // Not fetching pulse RPCs here (too much for a cron); safe defaults keep rules that
  // depend on TODAY's counts under-triggered rather than false-positive.
  const revenueCtx: RevenueContext = {
    currencySymbol: symToday,
    rnTonight: Number(todayKpi?.rn_tonight ?? 0),
    capacity: Number(todayKpi?.capacity ?? CAPACITY),
    occPct: Number(todayKpi?.occ_pct ?? 0),
    adrToday: Number(todayKpi?.adr_today ?? 0),
    revparToday: Number(todayKpi?.revpar_today ?? 0),
    pickupCount: 0, pickupValue: 0, cancelCount: 0, cancelValue: 0,
    paceNext90,
    topCountriesL14,
    ratePlanSleepingCount: sleepingCount,
    ratePlanTopSharePct,
    avgLosNext30,
    avgLosBaseline: null,
    targets,
  };

  // Parity context
  type IntegrityRow = { shop_date: string; stay_date: string; direct_usd: number | null; booking_usd: number | null; expedia_usd: number | null; agoda_usd: number | null; tiket_usd: number | null; spread_pct: number | string | null; spread_usd: number | string | null; otas_sold_out: number | null; };
  const allIntegrity = (integrityRes.data ?? []) as IntegrityRow[];
  const latestIntegShop = allIntegrity[0]?.shop_date ?? null;
  const integrityLatest = allIntegrity.filter((r) => r.shop_date === latestIntegShop);
  const spreadPcts = integrityLatest.map((r) => Number(r.spread_pct ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
  const maxSpreadPct = spreadPcts.length === 0 ? null : Math.max(...spreadPcts);
  const avgSpreadPct = spreadPcts.length === 0 ? null : spreadPcts.reduce((a, b) => a + b, 0) / spreadPcts.length;
  const worstRow = integrityLatest.reduce<IntegrityRow | null>((acc, r) => {
    const s = Number(r.spread_pct ?? 0);
    if (!Number.isFinite(s)) return acc;
    if (!acc || s > Number(acc.spread_pct ?? 0)) return r;
    return acc;
  }, null);
  const worstMaxOta = worstRow ? [
    { ota: 'Booking.com', usd: Number(worstRow.booking_usd ?? 0) },
    { ota: 'Expedia',     usd: Number(worstRow.expedia_usd ?? 0) },
    { ota: 'Agoda',       usd: Number(worstRow.agoda_usd ?? 0) },
    { ota: 'Tiket',       usd: Number(worstRow.tiket_usd ?? 0) },
  ].filter((x) => x.usd > 0).sort((a, b) => b.usd - a.usd)[0] ?? null : null;
  const maxSpreadUsd = worstRow != null ? Number(worstRow.spread_usd ?? 0) : null;
  const soldOutDaysP = integrityLatest.filter((r) => Number(r.otas_sold_out ?? 0) > 0).length;
  const lighthouseSnap = (((lighthouseLatestRes.data ?? []) as Array<{ shop_date: string }>)[0]?.shop_date) ?? null;

  type CompsetMatrixRow = { stay_date: string; pct_vs_cheapest_comp: number | string | null; num_comps_undercutting: number | null; comps_with_price: number | null };
  const compsetMatrix = (parityMatrixRes.data ?? []) as CompsetMatrixRow[];
  const shoppedRows = compsetMatrix.filter((r) => (r.comps_with_price ?? 0) > 0);
  const compsetStayDatesShopped = shoppedRows.length;
  const compsetUndercutDays = compsetMatrix.filter((r) => (r.num_comps_undercutting ?? 0) > 0).length;
  const pctRows = compsetMatrix.filter((r) => r.pct_vs_cheapest_comp != null).map((r) => Number(r.pct_vs_cheapest_comp));
  const compsetAvgPctVsCheapest = pctRows.length === 0 ? null : pctRows.reduce((a, b) => a + b, 0) / pctRows.length;

  type LhHistRow = { shop_date: string; stay_date: string; hotel_name: string; is_self: boolean | null; bar_rate: number | string | null };
  const lhHistory = (compsetHistoryRes.data ?? []) as LhHistRow[];
  const target3d = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
  const target7d = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  function nearestShop(dates: string[], target: string): string | null {
    let best: string | null = null; let bestDiff = Infinity;
    for (const d of dates) { const diff = Math.abs(new Date(d).getTime() - new Date(target).getTime()); if (diff < bestDiff) { bestDiff = diff; best = d; } }
    return best;
  }
  const compShops = Array.from(new Set(lhHistory.map((r) => r.shop_date))).sort();
  const latestShop = compShops[compShops.length - 1] ?? null;
  const shop3d = latestShop ? nearestShop(compShops, target3d) : null;
  const shop7d = latestShop ? nearestShop(compShops, target7d) : null;
  function maxRateChange(fromShop: string | null, toShop: string | null): number | null {
    if (!fromShop || !toShop || fromShop === toShop) return null;
    const byPair = new Map<string, { from?: number; to?: number }>();
    for (const r of lhHistory) {
      const k = `${r.hotel_name}::${r.stay_date}`;
      const rate = r.bar_rate == null ? null : Number(r.bar_rate);
      if (rate == null || !Number.isFinite(rate) || rate === 0) continue;
      if (r.shop_date === fromShop) byPair.set(k, { ...(byPair.get(k) ?? {}), from: rate });
      if (r.shop_date === toShop)   byPair.set(k, { ...(byPair.get(k) ?? {}), to: rate });
    }
    let maxAbs = 0;
    for (const v of byPair.values()) {
      if (v.from == null || v.to == null || v.from === 0) continue;
      const pct = Math.abs((v.to - v.from) / v.from) * 100;
      if (pct > maxAbs) maxAbs = pct;
    }
    return maxAbs > 0 ? maxAbs : null;
  }
  const compsetMaxRateChange3dPct = maxRateChange(shop3d, latestShop);
  const compsetMaxRateChange7dPct = maxRateChange(shop7d, latestShop);

  const parityCtx: ParityContext = {
    integritySnapshotDate: latestIntegShop,
    integrityStayDatesCount: integrityLatest.length,
    integrityMaxSpreadPct: maxSpreadPct,
    integrityMaxSpreadUsd: maxSpreadUsd,
    integrityAvgSpreadPct: avgSpreadPct,
    integritySoldOutDays: soldOutDaysP,
    integrityWorstStayDate: worstRow?.stay_date ?? null,
    integrityWorstDirectUsd: worstRow != null ? Number(worstRow.direct_usd ?? 0) : null,
    integrityWorstMaxOtaName: worstMaxOta?.ota ?? null,
    integrityWorstMaxOtaUsd: worstMaxOta?.usd ?? null,
    lighthouseSnapshotDate: lighthouseSnap,
    compsetStayDatesShopped,
    compsetUndercutDays,
    compsetAvgPctVsCheapest,
    compsetMaxRateChange3dPct,
    compsetMaxRateChange7dPct,
    targets: parityTargets,
  };

  // Rate-plan hygiene context
  type HygieneRow = { active_plans_total: number | null; sleeping_total: number | null; sleeping_over_2y: number | null; sleeping_1_2y: number | null; sleeping_180d_1y: number | null; never_booked: number | null; never_booked_pct: number | string | null; orphan_count: number | null; ytd_revenue_total: number | string | null; nrr_locked_share_pct: number | string | null; flex_share_pct: number | string | null; early_bird_share_pct: number | string | null; };
  const hyg = ((ratePlanHygieneRes as { data?: unknown } | null | undefined)?.data ?? null) as HygieneRow | null;
  const ratePlanCtx: RatePlanContext = {
    activePlansTotal:  Number(hyg?.active_plans_total ?? 0),
    sleepingTotal:     Number(hyg?.sleeping_total ?? 0),
    sleepingOver2y:    Number(hyg?.sleeping_over_2y ?? 0),
    sleeping1To2y:     Number(hyg?.sleeping_1_2y ?? 0),
    sleeping180dTo1y:  Number(hyg?.sleeping_180d_1y ?? 0),
    neverBooked:       Number(hyg?.never_booked ?? 0),
    neverBookedPct:    hyg?.never_booked_pct == null ? null : Number(hyg.never_booked_pct),
    orphanCount:       Number(hyg?.orphan_count ?? 0),
    ytdRevenueTotal:   Number(hyg?.ytd_revenue_total ?? 0),
    nrrLockedSharePct: hyg?.nrr_locked_share_pct == null ? null : Number(hyg.nrr_locked_share_pct),
    flexSharePct:      hyg?.flex_share_pct == null      ? null : Number(hyg.flex_share_pct),
    earlyBirdSharePct: hyg?.early_bird_share_pct == null? null : Number(hyg.early_bird_share_pct),
    targets: ratePlanTargets,
  };

  return [
    ...evaluateParityRules(parityCtx),
    ...runRatePlanRules(ratePlanCtx),
    ...evaluateRevenueRules(revenueCtx),
  ];
}

// Map an Insight into the fn_briefing_upsert argument shape.
// priority → severity is 1:1 except 'observation' → 'info' (briefing schema has no observation).
export function insightToUpsertArgs(propertyId: number, insight: Insight): {
  p_property_id: number; p_source_area: string; p_source_key: string; p_severity: string;
  p_headline: string; p_body: string; p_cta_kind: string | null; p_cta_label: string | null;
  p_cta_target: string | null; p_cta_params: Record<string, unknown>; p_kpi_baseline: Record<string, unknown>;
} {
  const severity = insight.priority === 'observation' ? 'info'
    : insight.priority === 'positive' ? 'info'
    : insight.priority; // critical | warning | info
  const source_key = insight.key ?? `unknown:${insight.title.slice(0, 60)}`;
  const source_area = source_key.startsWith('parity_') || source_key.startsWith('integrity_') || source_key.startsWith('compset_') || source_key.startsWith('lighthouse_')
    ? 'revenue.parity'
    : source_key.startsWith('rate_plan') || source_key.startsWith('nrr_') || source_key.startsWith('flex_') || source_key.startsWith('early_bird') || source_key.startsWith('sleeping_') || source_key.startsWith('orphan_')
      ? 'revenue.rateplans'
      : source_key.startsWith('fwd_') || source_key.startsWith('country_') || source_key.startsWith('sold_out') || source_key.startsWith('los_') || source_key.startsWith('net_revenue')
        ? 'revenue.pace'
        : 'revenue.rules';
  const body = [insight.body, insight.evidence, insight.action].filter(Boolean).join('\n\n');
  return {
    p_property_id: propertyId,
    p_source_area: source_area,
    p_source_key: source_key,
    p_severity: severity,
    p_headline: insight.title,
    p_body: body,
    p_cta_kind: insight.href ? 'link' : null,
    p_cta_label: insight.action ?? null,
    p_cta_target: insight.href ?? null,
    p_cta_params: {},
    p_kpi_baseline: {},
  };
}
