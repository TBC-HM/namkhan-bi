// app/operations/page.tsx
// PBS 2026-06-09 #138 — Operations HoD lands on shared HodLanding primitive.
// PBS 2026-07-06 — extra Gold container: "Flights to/from LPQ · today + tomorrow"
// PBS 2026-07-07 — Conclusions container (capture rates + heavy check-in day + sold-out signal).

import HodLanding from '@/app/_components/HodLanding';
import type { KpiTileProps } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import OpsFlightsContainer from './_components/OpsFlightsContainer';
import { evaluateOperationsRules, type OperationsContext, type OperationsTargets } from '@/lib/rules/operations';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const NAMKHAN_CAPACITY = 30;

export default async function OperationsPage() {
  const pid = PROPERTY_ID;
  const todayIso = new Date().toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);

  const [occResp, ciResp, coResp, flightsResp] = await Promise.all([
    supabase.from('v_otb_pace')
      .select('confirmed_rooms')
      .eq('property_id', pid)
      .eq('night_date', todayIso)
      .maybeSingle(),
    supabase.from('v_reservations_unified')
      .select('reservation_id', { count: 'exact', head: true })
      .eq('property_id', pid)
      .eq('is_cancelled', false)
      .eq('check_in_date', todayIso),
    supabase.from('v_reservations_unified')
      .select('reservation_id', { count: 'exact', head: true })
      .eq('property_id', pid)
      .eq('is_cancelled', false)
      .eq('check_out_date', todayIso),
    supabase.from('v_flights_to_lpq')
      .select('flight_date, origin, destination, airline, flight_number, dep_time_local, arr_time_local, price_lowest, currency')
      .gte('flight_date', todayIso)
      .lte('flight_date', tomorrowIso)
      .order('flight_date', { ascending: true })
      .order('dep_time_local', { ascending: true })
      .limit(200),
  ]);

  const occToday  = Number((occResp.data as { confirmed_rooms?: number } | null)?.confirmed_rooms ?? 0);
  const checkIns  = ciResp.count ?? 0;
  const checkOuts = coResp.count ?? 0;
  const cap       = NAMKHAN_CAPACITY;
  const occPct    = cap > 0 ? Math.round((occToday / cap) * 100) : 0;

  const liveTiles: KpiTileProps[] = [
    { label: 'Rooms occupied today', value: `${occToday}/${cap}`, footnote: `${occPct}% occupancy · cap ${cap}`,
      status: (occPct >= 80 ? 'green' : occPct >= 50 ? 'amber' : 'grey') as 'green'|'amber'|'grey', size: 'sm' },
    { label: 'Check-ins today',  value: checkIns,  footnote: `${todayIso}`, status: checkIns  > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Check-outs today', value: checkOuts, footnote: `${todayIso}`, status: checkOuts > 0 ? 'green' : 'grey', size: 'sm' },
  ];

  // PBS 2026-07-07: build operations conclusion context.
  const sbAdmin = getSupabaseAdmin();
  const targets: OperationsTargets = {};
  try {
    const { data } = await sbAdmin
      .from('guardrails')
      .select('rule_key, threshold_val')
      .eq('property_id', pid).eq('domain', 'operations').eq('active', true);
    for (const g of (data ?? []) as Array<{ rule_key: string; threshold_val: number | string }>) {
      const n = typeof g.threshold_val === 'string' ? Number(g.threshold_val) : g.threshold_val;
      if (!Number.isFinite(n)) continue;
      if (g.rule_key === 'fnb_capture_target') targets.fnb_capture_target = n;
      else if (g.rule_key === 'spa_capture_target') targets.spa_capture_target = n;
      else if (g.rule_key === 'activities_capture') targets.activities_capture = n;
      else if (g.rule_key === 'housekeeping_lag_min') targets.housekeeping_lag_min = n;
    }
  } catch { /* ignore */ }

  // Capture rates — from kpi.v_ancillary_capture_daily if reachable. Best-effort.
  let fnbCapture: number | null = null;
  let spaCapture: number | null = null;
  let activitiesCapture: number | null = null;
  try {
    const { data } = await sbAdmin
      .from('v_ancillary_capture_daily')
      .select('fb_capture_pct, spa_capture_pct, activity_capture_pct')
      .eq('property_id', pid)
      .eq('date', todayIso)
      .maybeSingle();
    if (data) {
      const row = data as { fb_capture_pct?: number | null; spa_capture_pct?: number | null; activity_capture_pct?: number | null };
      fnbCapture = row.fb_capture_pct ?? null;
      spaCapture = row.spa_capture_pct ?? null;
      activitiesCapture = row.activity_capture_pct ?? null;
    }
  } catch { /* view unreachable = rules silent */ }

  const opsCtx: OperationsContext = {
    occToday,
    capacity: cap,
    occPct,
    checkIns,
    checkOuts,
    fnbCaptureToday: fnbCapture,
    spaCaptureToday: spaCapture,
    activitiesCaptureToday: activitiesCapture,
    targets,
  };
  const insights = evaluateOperationsRules(opsCtx);

  const activeTargets = Object.entries(targets)
    .map(([k, v]) => `${k}=${v}`).join(' · ') || 'no DB targets · using fallback defaults';

  const initialFlights = (flightsResp.data as Array<{
    flight_date: string; origin: string; destination: string;
    airline: string | null; flight_number: string | null;
    dep_time_local: string | null; arr_time_local: string | null;
    price_lowest: number | null; currency: string | null;
  }>) ?? [];

  return (
    <HodLanding
      slug="operations"
      liveTiles={liveTiles}
      extraContainers={<OpsFlightsContainer initial={initialFlights} />}
      conclusions={{
        insights,
        title: 'CONCLUSIONS · capture · arrivals · sold-out',
        subtitle: `Live: ${occToday}/${cap} · ${checkIns} check-ins · ${checkOuts} check-outs · DB targets: ${activeTargets}`,
      }}
    />
  );
}
