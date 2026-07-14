// app/revenue/page.tsx
// Revenue HoD landing — rev-manager morning brief.
// 2026-07-07 v4: Conclusions container reframed for FORWARD outlook (14/30/60/90d
// windows + country pace + rate plan mix + LOS trend) rather than tonight only.

import TenantLink from '@/components/nav/TenantLink';
import {
  DashboardPage, Container, KpiTile,
  type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import type { DeptCfg } from '@/lib/dept-cfg/types';
import { REVENUE_SUBPAGES } from './_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getDeptCfg } from '@/lib/dept-cfg/by-property';
import { PROPERTY_ID, supabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ScheduledReportsTable, SendLogTable, type ScheduledRow, type SendLogRow } from './_components/RevenueReportsTables';
import ShortcutsPanel, { type Shortcut } from './_components/ShortcutsPanel';
import ExternalLinksPanel, { type ExternalLink } from './_components/ExternalLinksPanel';
import HodTasksList from './_components/HodTasksList';
import AttentionList from './_components/AttentionList';
import RmMailPanel from './_components/RmMailPanel';
import { getPulseTodayPickup, getPulseTodayCancellations } from '@/lib/data-pulse';
import BookingActivity from '@/app/(cockpit)/_design/BookingActivity';
import ConclusionBlock from '@/app/_components/ConclusionBlock';
import {
  evaluateRevenueRules,
  type RevenueContext, type RevenueTargets,
  type PaceNight, type CountryPickup,
} from '@/lib/rules/revenue';
import { evaluateParityRules, type ParityContext, type ParityTargets } from '@/lib/rules/parity';
import { runRatePlanRules, type RatePlanContext, type RatePlanTargets } from '@/lib/rules/rateplans';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props {
  propertyId?: number;
  searchParams?: Record<string, string | string[] | undefined>;
}

// Namkhan capacity constant — same value referenced across pace/pulse pages.
const CAPACITY = 30;

function shiftYear(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + delta);
  return d.toISOString().slice(0, 10);
}

export default async function RevenueHoDPage({ propertyId, searchParams }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const cfg: DeptCfg = pid === PROPERTY_ID ? DEPT_CFG.revenue : getDeptCfg('revenue', pid);
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const sections = subPages;

  const todayIso = new Date().toISOString().slice(0, 10);
  const in90Iso = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);
  const in30Iso = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const in14Iso = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const lyFromIso = shiftYear(todayIso, -1);
  const lyToIso = shiftYear(in90Iso, -1);
  const l14FromIso = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  const l14FromLyIso = shiftYear(l14FromIso, -1);
  const l14ToLyIso = shiftYear(todayIso, -1);

  const sbAdmin = getSupabaseAdmin();

  const [
    pickupToday, cancellationsToday, bugsRes, dueTasksRes,
    todayKpiRes, guardrailsRes,
    paceRes, stlyRes,
    l14PickupRes, l14LyPickupRes,
    next30ArrivalsRes,
    attnRes,
    scheduledRes,
    sendsRes,
    myReportsRes,
    shortcutsRes,
    integrityRes,
    lighthouseLatestRes,
    parityMatrixRes,
    compsetHistoryRes,
    ratePlanHygieneRes,
  ] = await Promise.all([
    getPulseTodayPickup(pid, todayIso).catch(() => [] as Array<unknown>),
    getPulseTodayCancellations(pid, todayIso).catch(() => [] as Array<unknown>),
    supabase.from('cockpit_bugs').select('id, body, status, created_at, page_url').not('status','in','(closed,resolved,wontfix,done)').order('created_at', { ascending: false }).limit(5),
    supabase.from('v_hod_tasks_due').select('id', { count: 'exact', head: true }).eq('dept_slug', 'revenue').eq('property_id', pid).eq('is_due', true),
    supabase.rpc('fn_revenue_hod_today_kpi', { p_property_id: pid }),
    sbAdmin.from('guardrails').select('rule_key, threshold_val').eq('property_id', pid).eq('domain', 'revenue').eq('active', true),
    supabase.from('v_otb_pace').select('night_date, confirmed_rooms').eq('property_id', pid).gte('night_date', todayIso).lte('night_date', in90Iso).order('night_date'),
    supabase.from('mv_kpi_daily').select('night_date, rooms_sold').eq('property_id', pid).gte('night_date', lyFromIso).lte('night_date', lyToIso),
    supabase.from('v_reservations_unified').select('reservation_id, booking_date, check_in_date, check_out_date, guest_country_iso2, rate_plan_name').eq('property_id', pid).eq('is_cancelled', false).gte('booking_date', l14FromIso).lte('booking_date', todayIso),
    supabase.from('v_reservations_unified').select('reservation_id, guest_country_iso2').eq('property_id', pid).eq('is_cancelled', false).gte('booking_date', l14FromLyIso).lte('booking_date', l14ToLyIso),
    supabase.from('v_reservations_unified').select('reservation_id, check_in_date, check_out_date').eq('property_id', pid).eq('is_cancelled', false).gte('check_in_date', todayIso).lte('check_in_date', in30Iso),
    // PBS 2026-07-08 #204/attention — attention flags come from cockpit.attention_flags via SECURITY DEFINER RPC.
    supabase.rpc('fn_attention_list', { p_property_id: pid, p_dept: 'revenue', p_user_email: 'pbsbase@gmail.com' }),
    // PBS 2026-07-08 (final Reports UX): scheduled recipients + full send log + "sent to me" list for My Reports box
    supabase.from('v_revenue_report_recipients').select('id, property_id, template_key, cadence, email, name, next_fire_at, created_at').eq('property_id', pid).order('next_fire_at', { ascending: true }).limit(500),
    supabase.from('v_revenue_report_sends').select('id, property_id, template_key, sent_at, recipient_email, created_by, report_name, status').eq('property_id', pid).limit(200),
    supabase.from('v_revenue_report_sends').select('id, property_id, template_key, sent_at, recipient_email, created_by, report_name, status').eq('property_id', pid).eq('recipient_email', 'pbsbase@gmail.com').order('sent_at', { ascending: false }).limit(20),
    supabase.from('v_hod_shortcuts').select('id, label, href, kind').eq('property_id', pid).eq('dept_slug', 'revenue').eq('user_email', 'pbsbase@gmail.com').order('sort_order').limit(100),
    // PBS 2026-07-09: Own-OTA rate integrity — for parity guardrail conclusions.
    supabase.from('v_rate_integrity_matrix').select('shop_date, stay_date, direct_usd, booking_usd, expedia_usd, agoda_usd, tiket_usd, spread_pct, spread_usd, otas_sold_out').eq('property_id', pid).order('shop_date', { ascending: false }).order('stay_date', { ascending: true }),
    // PBS 2026-07-09: Lighthouse latest shop_date — staleness signal.
    supabase.from('v_lighthouse_rateshop').select('shop_date').eq('property_id', pid).order('shop_date', { ascending: false }).limit(1),
    // PBS 2026-07-09 pm: compset delta signals for HoD conclusions.
    supabase.from('v_parity_matrix_pb').select('stay_date, pct_vs_cheapest_comp, num_comps_undercutting, comps_with_price').eq('property_id', pid).order('stay_date', { ascending: true }),
    // Lighthouse compset historical shops for 3d/7d rate-change signals.
    supabase.from('v_lighthouse_rateshop').select('shop_date, stay_date, hotel_name, is_self, bar_rate').eq('property_id', pid).eq('feed_source', 'compset').gte('shop_date', new Date(Date.now() - 8 * 86400_000).toISOString().slice(0, 10)),
    // PBS 2026-07-09 pm: rate-plan hygiene aggregate (per property).
    // Fail-open: any error here must NOT nuke the whole /revenue HoD render.
    sbAdmin.from('v_rate_plan_hygiene').select('active_plans_total, sleeping_total, sleeping_over_2y, sleeping_1_2y, sleeping_180d_1y, never_booked, never_booked_pct, orphan_count, ytd_revenue_total, nrr_locked_share_pct, flex_share_pct, early_bird_share_pct').eq('property_id', pid).maybeSingle().then((r) => r, () => ({ data: null, error: null })),
  ]);
  const scheduledRows = (scheduledRes.data ?? []) as ScheduledRow[];
  const sendLogRows   = (sendsRes.data ?? []) as SendLogRow[];
  const myReportRows  = (myReportsRes.data ?? []) as SendLogRow[];
  const allShortcuts  = (shortcutsRes.data ?? []) as Array<Shortcut & { kind?: string }>;
  const shortcuts     = allShortcuts.filter((s) => (s.kind ?? 'internal') === 'internal');
  const externalLinks = allShortcuts.filter((s) => s.kind === 'external') as ExternalLink[];

  const todayKpi = ((todayKpiRes.data ?? [])[0] ?? null) as { rn_tonight: number; capacity: number; occ_pct: number; adr_today: number; revpar_today: number } | null;
  const bugs = (bugsRes.data ?? []) as Array<{ id: number; body: string | null; status: string | null; created_at: string | null; page_url: string | null }>;
  const dueTasksCount = dueTasksRes.count ?? 0;
  const symToday = pid === 1000001 ? '€' : '$';

  const pickupCount = pickupToday.length;
  const cancelCount = cancellationsToday.length;
  const pickupValue = (pickupToday as Array<{ value?: number | null }>).reduce((s, r) => s + (Number(r.value) || 0), 0);
  const cancelValue = (cancellationsToday as Array<{ value?: number | null }>).reduce((s, r) => s + (Number(r.value) || 0), 0);

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
    // PBS 2026-07-09 pm: rate-plan hygiene targets.
    else if (g.rule_key === 'nrr_share_target')            ratePlanTargets.nrr_share_target = n;
    else if (g.rule_key === 'early_bird_share_target')     ratePlanTargets.early_bird_share_target = n;
    else if (g.rule_key === 'flex_share_max')              ratePlanTargets.flex_share_max = n;
    else if (g.rule_key === 'sleeping_plan_max_days')      ratePlanTargets.sleeping_plan_max_days = n;
    else if (g.rule_key === 'never_booked_plan_max_share') ratePlanTargets.never_booked_plan_max_share = n;
    else if (g.rule_key === 'orphan_catalogue_gap_max')    ratePlanTargets.orphan_catalogue_gap_max = n;
  }

  // Build paceNext90 with STLY join
  const stlyMap = new Map<string, number>();
  for (const r of ((stlyRes.data ?? []) as Array<{ night_date: string; rooms_sold: number | null }>)) {
    stlyMap.set(String(r.night_date), Number(r.rooms_sold ?? 0));
  }
  const paceRows = (paceRes.data ?? []) as Array<{ night_date: string; confirmed_rooms: number | null }>;
  const paceNext90: PaceNight[] = paceRows.map((r) => {
    const shifted = shiftYear(r.night_date, -1);
    const stly = stlyMap.has(shifted) ? stlyMap.get(shifted)! : null;
    const rooms = Number(r.confirmed_rooms ?? 0);
    const daysOut = Math.max(0, Math.round((new Date(r.night_date).getTime() - Date.now()) / 86400_000));
    return {
      night_date: r.night_date,
      daysOut,
      confirmedRooms: rooms,
      capacity: CAPACITY,
      occPct: CAPACITY > 0 ? (rooms / CAPACITY) * 100 : 0,
      stlyRooms: stly,
    };
  });

  // L14 country pickup (top 5) + LY comparison
  const l14Rows = (l14PickupRes.data ?? []) as Array<{ guest_country_iso2: string | null; rate_plan_name: string | null }>;
  const l14LyRows = (l14LyPickupRes.data ?? []) as Array<{ guest_country_iso2: string | null }>;
  const countryL14 = new Map<string, number>();
  const countryL14Ly = new Map<string, number>();
  for (const r of l14Rows) {
    const c = r.guest_country_iso2 || 'UNK';
    countryL14.set(c, (countryL14.get(c) ?? 0) + 1);
  }
  for (const r of l14LyRows) {
    const c = r.guest_country_iso2 || 'UNK';
    countryL14Ly.set(c, (countryL14Ly.get(c) ?? 0) + 1);
  }
  const topCountriesL14: CountryPickup[] = Array.from(countryL14.entries())
    .filter(([c]) => c !== 'UNK')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, pickupL14]) => ({
      country,
      pickupL14,
      pickupLyL14: countryL14Ly.get(country) ?? null,
    }));

  // Rate plan sleeping + concentration (L14)
  const rateCounts = new Map<string, number>();
  for (const r of l14Rows) {
    const name = r.rate_plan_name || 'unknown';
    rateCounts.set(name, (rateCounts.get(name) ?? 0) + 1);
  }
  const totalPickupL14 = l14Rows.length;
  const ratePlanTopSharePct: number | null = totalPickupL14 > 0
    ? (Math.max(0, ...Array.from(rateCounts.values())) / totalPickupL14) * 100
    : null;
  const sleepingCount = totalPickupL14 > 0
    ? Array.from(rateCounts.values()).filter(c => c === 0).length
    : null; // strictly a placeholder; a proper sleep view would list all plans

  // LOS avg on next-30d arrivals
  const next30 = (next30ArrivalsRes.data ?? []) as Array<{ check_in_date: string | null; check_out_date: string | null }>;
  const losValues = next30
    .filter(r => r.check_in_date && r.check_out_date)
    .map(r => Math.max(1, Math.round((new Date(r.check_out_date!).getTime() - new Date(r.check_in_date!).getTime()) / 86400_000)));
  const avgLosNext30 = losValues.length > 0 ? losValues.reduce((s, v) => s + v, 0) / losValues.length : null;

  const revenueCtx: RevenueContext = {
    currencySymbol: symToday,
    rnTonight: Number(todayKpi?.rn_tonight ?? 0),
    capacity: Number(todayKpi?.capacity ?? CAPACITY),
    occPct: Number(todayKpi?.occ_pct ?? 0),
    adrToday: Number(todayKpi?.adr_today ?? 0),
    revparToday: Number(todayKpi?.revpar_today ?? 0),
    pickupCount, pickupValue, cancelCount, cancelValue,
    paceNext90,
    topCountriesL14,
    ratePlanSleepingCount: sleepingCount,
    ratePlanTopSharePct,
    avgLosNext30,
    avgLosBaseline: null,
    targets,
  };
  // PBS 2026-07-09: build ParityContext from lighthouse feeds and evaluate.
  type IntegrityRow = {
    shop_date: string; stay_date: string;
    direct_usd: number | null; booking_usd: number | null;
    expedia_usd: number | null; agoda_usd: number | null; tiket_usd: number | null;
    spread_pct: number | string | null; spread_usd: number | string | null;
    otas_sold_out: number | null;
  };
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
  const soldOutDays = integrityLatest.filter((r) => Number(r.otas_sold_out ?? 0) > 0).length;

  const lighthouseSnap = (((lighthouseLatestRes.data ?? []) as Array<{ shop_date: string }>)[0]?.shop_date) ?? null;

  // Compset delta signals — from v_parity_matrix_pb
  type CompsetMatrixRow = { stay_date: string; pct_vs_cheapest_comp: number | string | null; num_comps_undercutting: number | null; comps_with_price: number | null };
  const compsetMatrix = (parityMatrixRes.data ?? []) as CompsetMatrixRow[];
  const shoppedRows = compsetMatrix.filter((r) => (r.comps_with_price ?? 0) > 0);
  const compsetStayDatesShopped = shoppedRows.length;
  const compsetUndercutDays = compsetMatrix.filter((r) => (r.num_comps_undercutting ?? 0) > 0).length;
  const pctRows = compsetMatrix.filter((r) => r.pct_vs_cheapest_comp != null).map((r) => Number(r.pct_vs_cheapest_comp));
  const compsetAvgPctVsCheapest = pctRows.length === 0 ? null : pctRows.reduce((a, b) => a + b, 0) / pctRows.length;

  // Rate-change signals — compute max abs pct change per hotel between shop_dates over 3d / 7d.
  type LhHistRow = { shop_date: string; stay_date: string; hotel_name: string; is_self: boolean | null; bar_rate: number | string | null };
  const lhHistory = (compsetHistoryRes.data ?? []) as LhHistRow[];
  const nowIso = new Date().toISOString().slice(0, 10);
  const target3d = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
  const target7d = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  function nearestShop(dates: string[], target: string): string | null {
    let best: string | null = null;
    let bestDiff = Infinity;
    for (const d of dates) {
      const diff = Math.abs(new Date(d).getTime() - new Date(target).getTime());
      if (diff < bestDiff) { bestDiff = diff; best = d; }
    }
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
    integritySoldOutDays: soldOutDays,
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
  const parityInsights = evaluateParityRules(parityCtx);

  // PBS 2026-07-09 pm: Rate-plan hygiene context — one row per property, aggregated in v_rate_plan_hygiene.
  type HygieneRow = {
    active_plans_total: number | null;
    sleeping_total: number | null;
    sleeping_over_2y: number | null;
    sleeping_1_2y: number | null;
    sleeping_180d_1y: number | null;
    never_booked: number | null;
    never_booked_pct: number | string | null;
    orphan_count: number | null;
    ytd_revenue_total: number | string | null;
    nrr_locked_share_pct: number | string | null;
    flex_share_pct: number | string | null;
    early_bird_share_pct: number | string | null;
  };
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
  const ratePlanInsights = runRatePlanRules(ratePlanCtx);

  const revenueInsights = [...parityInsights, ...ratePlanInsights, ...evaluateRevenueRules(revenueCtx)];

  const activeTargets = Object.entries(targets).map(([k, v]) => `${k}=${v}`).join(' · ') || 'fallback defaults';
  // Next 30 nights = tomorrow through 30 days out (excludes today so it's a clean 30-night window).
  const softNightsNext30 = Math.min(
    30,
    paceNext90.filter(n => n.daysOut >= 1 && n.daysOut <= 30 && n.occPct < 50).length,
  );
  // Total room nights + revenue booked TODAY across all new reservations.
  // PBS 2026-07-08: revenue added alongside nights so the tile shows the value delta.
  const pickupNightsSum = (pickupToday as Array<{ nights?: number | null }>).reduce((s, r) => s + (Number(r.nights) || 0), 0);
  const pickupRevenueSum = (pickupToday as Array<{ value?: number | null }>).reduce((s, r) => s + (Number(r.value) || 0), 0);
  const cancelNightsSum = (cancellationsToday as Array<{ nights?: number | null }>).reduce((s, r) => s + (Number(r.nights) || 0), 0);
  const cancelRevenueSum = (cancellationsToday as Array<{ value?: number | null }>).reduce((s, r) => s + (Number(r.value) || 0), 0);

  // PBS 2026-07-07 evening: strip 10% VAT + 10% service (compound 21%) so KPI tiles show NET values matching Cloudbeds + USALI.
  const TAX_SERVICE = 1.21;
  const netAdr    = Math.round(Number(todayKpi?.adr_today ?? 0)    / TAX_SERVICE);
  const netRevpar = Math.round(Number(todayKpi?.revpar_today ?? 0) / TAX_SERVICE);
  const netRevenueTonight = Math.round(Number(todayKpi?.rn_tonight ?? 0) * netAdr);

  // KPI tiles (same as before + one forward-looking tile)
  const baseTiles: KpiTileProps[] = (cfg.kpiTiles ?? []).map((k) => {
    if (todayKpi) {
      if (k.k === 'OCC')    return { label: 'OCC',    value: `${todayKpi.occ_pct ?? 0}%`, size: 'sm', footnote: `${todayKpi.rn_tonight ?? 0} of ${todayKpi.capacity ?? 0} rooms tonight` } as KpiTileProps;
      if (k.k === 'ADR')    return { label: 'ADR',    value: `${symToday}${netAdr.toLocaleString('en-US')}`,    size: 'sm', footnote: 'today · in-house · net' } as KpiTileProps;
      if (k.k === 'RevPAR') return { label: 'RevPAR', value: `${symToday}${netRevpar.toLocaleString('en-US')}`, size: 'sm', footnote: 'today · vs capacity · net' } as KpiTileProps;
    }
    return { label: k.k, value: k.v, size: 'sm', footnote: k.d } as KpiTileProps;
  });
  const tiles: KpiTileProps[] = [
    ...baseTiles,
    { label: 'Revenue tonight', value: `${symToday}${netRevenueTonight.toLocaleString('en-US')}`, size: 'sm',
      footnote: `${todayKpi?.rn_tonight ?? 0} rooms × ADR · net`,
      status: netRevenueTonight > 0 ? 'green' : 'grey' },
    // PBS 2026-07-07 evening: room-nights headline, bookings count in small print.
    // PBS 2026-07-08: revenue added to footnote so the tile shows the value picked up / lost.
    { label: 'Pickup today · room nights', value: pickupNightsSum, size: 'sm',
      footnote: pickupCount === 0
        ? 'no new bookings'
        : `${pickupCount} ${pickupCount === 1 ? 'booking' : 'bookings'} · ${symToday}${Math.round(pickupRevenueSum).toLocaleString('en-US')} · created today`,
      status: pickupNightsSum > 0 ? 'green' : 'grey' },
    { label: 'Cancellations today · room nights', value: cancelNightsSum, size: 'sm',
      footnote: cancelCount === 0
        ? 'no cancellations'
        : `${cancelCount} ${cancelCount === 1 ? 'booking' : 'bookings'} · ${symToday}${Math.round(cancelRevenueSum).toLocaleString('en-US')} · lost today`,
      status: cancelCount === 0 ? 'green' : 'amber' },
    { label: 'Soft nights (next 30d)', value: softNightsNext30, size: 'sm',
      footnote: '< 50% OCC · window still open',
      status: softNightsNext30 === 0 ? 'green' : softNightsNext30 > 8 ? 'amber' : 'grey' },
  ];

  // PBS 2026-07-08 #204/attention — DB rows first, seed fallback for dev only.
  type AttnRow = { id: number; kind: string | null; label: string; body: string | null; severity: string; source: string | null; link_href: string | null; created_at: string | null };
  const attnRows = ((attnRes.data ?? []) as AttnRow[]);
  const attnFromDb = attnRows.map(r => ({ id: String(r.id), label: r.label, kind: r.kind ?? undefined, severity: r.severity, href: r.link_href ?? undefined, body: r.body ?? undefined, source: 'db' as const }));
  const attnSeed = (cfg.defaultAttn ?? []).map(a => ({ id: a.id, label: a.label, kind: a.kind, severity: a.severity, source: 'seed' as const }));
  const useSeed = attnFromDb.length === 0 && process.env.NODE_ENV !== 'production';
  const attn = useSeed ? attnSeed : attnFromDb;
  const attnSubtitle = useSeed
    ? `${attn.length} item${attn.length === 1 ? '' : 's'} · dev seed · dismiss with ×`
    : `${attn.length} item${attn.length === 1 ? '' : 's'} · live · dismiss with ×`;
  const docs = cfg.defaultDocs ?? [];
  const reportTypes = cfg.reportTypes ?? [];
  // PBS 2026-07-08: unified report catalog for the Scheduled reports picker.
  // Includes the 3 built-in scheduled reports + every dept-cfg report type.
  const reportOptions = [
    { value: 'daily',   label: 'Daily revenue report' },
    { value: 'weekly',  label: 'Weekly revenue report' },
    { value: 'monthly', label: 'Monthly revenue report' },
    ...reportTypes.map((rt) => ({ value: rt.value, label: rt.label })),
  ];

  const DONNA_PROPERTY_ID = 1000001;
  const chatHref = pid === DONNA_PROPERTY_ID
    ? `/cockpit/chat?dept=revenue&role=revenue_hod_donna&name=Mira&emoji=${encodeURIComponent('📈')}&label=Revenue`
    : `/cockpit/chat?dept=revenue`;

  const hodHrefs = ['/revenue', `/h/${pid}/revenue`];
  const hodTabs = sections.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.label === 'HoD' && hodHrefs.includes('/revenue'),
  }));

  return (
    <DashboardPage
      title={`Revenue · ${cfg.hodName}`}
      subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      tabs={hodTabs}
      action={<TenantLink href={chatHref} style={primaryBtnStyle}>{`Ask ${cfg.hodName} →`}</TenantLink>}
    >
      {tiles.length > 0 && (
        <div style={fullRow}>
          <Container title="Headline" subtitle="snapshot · last refresh · money tiles NET (excl. 10% VAT + 10% service charge)" density="compact">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
            </div>
          </Container>
        </div>
      )}

      {/* PBS 2026-07-08 (final): grid tightened to 4 tiles — Attention · My Reports (self-sends) · My Tasks · Bugs.
          Scheduled + Send log get their own full-width containers below. */}
      <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <Container title="Shortcuts" subtitle="Pin any page for one-click access · × to remove" density="compact">
          <ShortcutsPanel initial={shortcuts} propertyId={pid} deptSlug="revenue" userEmail="pbsbase@gmail.com" />
        </Container>
        <Container title="My Reports" subtitle={`${myReportRows.length} report${myReportRows.length === 1 ? '' : 's'} sent to you · from send log`} density="compact">
          {myReportRows.length === 0 ? (
            <div style={{ fontSize: 11, color: '#5A5A5A', fontStyle: 'italic', padding: '8px 4px' }}>
              No reports have been sent to you yet. Add yourself as a recipient below.
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {myReportRows.map((r) => (
                <li key={r.id} style={{ fontSize: 11, color: '#1B1B1B', display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600 }}>{r.report_name}</span>
                  <span style={{ color: '#5A5A5A' }}>· {new Date(r.sent_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          )}
        </Container>
        <Container title="My Tasks" subtitle={dueTasksCount > 0 ? `🔴 ${dueTasksCount} due · add / due-date / repeat / delete` : 'add / due-date / repeat / delete · per property'} density="compact">
          <HodTasksList deptSlug="revenue" propertyId={pid} />
        </Container>
        <Container title="External links" subtitle="Extranet · Cloudbeds · SLH login · anywhere outside the cockpit" density="compact">
          <ExternalLinksPanel initial={externalLinks} propertyId={pid} deptSlug="revenue" userEmail="pbsbase@gmail.com" />
        </Container>
      </div>

      {/* PBS 2026-07-08 (final): scheduled reports table.
          Report options now include the 3 built-in scheduled reports (Daily/Weekly/Monthly)
          + every report type from the department config. Build a report container removed. */}
      {/* Daily Briefing — rev-manager forward brief.
          PBS 2026-07-08 (final): renamed from "Conclusions" and made expandable
          via <details>. Default open. ConclusionBlock stays in `bare` mode. */}
      {/* PBS 2026-07-08 final: `alignSelf:start` on the wrapper prevents the
          auto-fit grid from stretching neighbour cells; internal max-height
          + overflowY:auto keeps the box compact even with 20+ insights so nothing
          overflows the parent grid track ("half-content-lost" bug). */}
      <div style={{ ...fullRow, alignSelf: 'start' }}>
        <details open style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6, width: '100%' }}>
          <summary style={{
            cursor: 'pointer', padding: '10px 14px', borderBottom: '1px solid #E6DFCC',
            display: 'flex', flexDirection: 'column', gap: 2, background: '#FAFAF7',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1B1B1B' }}>Daily Briefing</span>
            <span style={{ fontSize: 11, color: '#5A5A5A' }}>
              14/30/60/90d windows · countries · rate plans · LOS · {paceNext90.length} nights forward · {totalPickupL14} bookings L14 · {topCountriesL14.length} source markets · targets: {activeTargets}
            </span>
          </summary>
          <div style={{ padding: 12, maxHeight: '70vh', overflowY: 'auto' }}>
            <ConclusionBlock
              bare
              groupByPriority
              insights={revenueInsights}
              emptyText="Everything nominal. No forward-window alarms firing."
              storageKey={`revenue_hod_signals:${pid}`}
              maxRender={30}
            />
          </div>
        </details>
      </div>

      <div style={fullRow}>
        <BookingActivity propertyId={pid} searchParams={searchParams} />
      </div>

      {/* PBS 2026-07-14: Reservations Manager mail feed — Mai Vo only.
          Full-width, sits above Scheduled reports. Client component polls
          /api/hod/revenue/mails every 60s while tab visible. */}
      <div style={fullRow}>
        <RmMailPanel />
      </div>

      {/* PBS 2026-07-08: Scheduled reports + Send log moved to the BOTTOM of the
          HoD landing so they don't push the daily brief below the fold.
          2026-07-09 pm: both wrapped in <details> so PBS can collapse them to a
          single-line header when he wants more brief real estate. */}
      <div style={fullRow}>
        <details open style={{ border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF' }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#1B1B1B', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1EBD9' }}>
            <span>Scheduled reports <span style={{ fontSize: 11, color: '#5A5A5A', fontWeight: 500 }}>· {scheduledRows.length}</span></span>
            <span style={{ fontSize: 11, color: '#5A5A5A', fontWeight: 500 }}>click to collapse</span>
          </summary>
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 8 }}>
              Pick any report · pick a cadence · fires at 08:00 UTC · sort any column · Preview to open · × to dismiss a single row · check rows for bulk delete
            </div>
            <ScheduledReportsTable rows={scheduledRows} propertyId={pid} reportOptions={reportOptions} />
          </div>
        </details>
      </div>

      <div style={fullRow}>
        <details open style={{ border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF' }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#1B1B1B', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1EBD9' }}>
            <span>Reports · send log <span style={{ fontSize: 11, color: '#5A5A5A', fontWeight: 500 }}>· {sendLogRows.length}</span></span>
            <span style={{ fontSize: 11, color: '#5A5A5A', fontWeight: 500 }}>click to collapse</span>
          </summary>
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 8 }}>
              Every report ever sent · sort any column · bulk-delete with checkboxes
            </div>
            <SendLogTable rows={sendLogRows} />
          </div>
        </details>
      </div>

    </DashboardPage>
  );
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
const primaryBtnStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 14px', borderRadius: 4, background: 'var(--primary, #1F3A2E)', color: '#FFFFFF', textDecoration: 'none',
};
