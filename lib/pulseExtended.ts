// lib/pulseExtended.ts
// D5: extra Pulse KPIs not in mv_kpi_daily — Cancel%, No-Show%, Lead Time (days), ALOS.
// Queries `reservations` directly. Each metric is wrapped in try/catch so a missing column
// or RLS denial returns null and the Pulse page falls back to the mockup placeholder value.
//
// OPEN: confirmed Cloudbeds-mirror table name + columns. Defaults assume:
//   reservations.status         text   — values include 'cancelled' / 'no_show' / 'confirmed' / 'checked_in' / etc.
//   reservations.no_show         boolean (optional — may be encoded into status instead)
//   reservations.created_at     timestamptz — booking date
//   reservations.arrival_date    date    — check-in date
//   reservations.nights          int     — length of stay
//   reservations.property_id     bigint  — for our scope
// If actual columns differ, this returns null and the mockup placeholders stay.

import { supabase, PROPERTY_ID } from './supabase';
import type { ResolvedPeriod } from './period';

export interface PulseExtendedKpis {
  cancelPct: number | null;     // % of reservations cancelled in the period
  noShowPct: number | null;     // % of reservations no-show in the period
  leadTimeDays: number | null;  // avg days between booking and arrival
  alosNights: number | null;    // avg nights per stay
}

/**
 * Best-effort fetch of the 4 extended KPIs for a resolved period.
 * Returns nulls per metric on any error — caller falls back to mockup placeholder.
 */
export async function getPulseExtendedKpis(period: ResolvedPeriod): Promise<PulseExtendedKpis> {
  const result: PulseExtendedKpis = {
    cancelPct: null,
    noShowPct: null,
    leadTimeDays: null,
    alosNights: null,
  };

  try {
    // Pull reservations whose arrival_date overlaps the period window.
    const { data, error } = await supabase
      .from('reservations')
      .select('status, created_at, arrival_date, nights')
      .eq('property_id', PROPERTY_ID)
      .gte('arrival_date', period.from)
      .lte('arrival_date', period.to);

    if (error || !data || data.length === 0) return result;

    const total = data.length;
    let cancelled = 0;
    let noShow = 0;
    let leadSum = 0;
    let leadN = 0;
    let nightsSum = 0;
    let nightsN = 0;

    for (const r of data as Array<Record<string, unknown>>) {
      const status = String(r.status ?? '').toLowerCase();
      if (status.includes('cancel')) cancelled++;
      if (status.includes('no_show') || status.includes('no-show')) noShow++;

      const created = r.created_at ? new Date(String(r.created_at)) : null;
      const arrival = r.arrival_date ? new Date(String(r.arrival_date)) : null;
      if (created && arrival && !isNaN(created.getTime()) && !isNaN(arrival.getTime())) {
        const days = Math.max(0, Math.round((arrival.getTime() - created.getTime()) / 86_400_000));
        leadSum += days;
        leadN++;
      }

      const nights = Number(r.nights ?? 0);
      if (nights > 0) {
        nightsSum += nights;
        nightsN++;
      }
    }

    result.cancelPct = total > 0 ? (cancelled / total) * 100 : null;
    result.noShowPct = total > 0 ? (noShow / total) * 100 : null;
    result.leadTimeDays = leadN > 0 ? leadSum / leadN : null;
    result.alosNights = nightsN > 0 ? nightsSum / nightsN : null;
  } catch {
    // Swallow — mockup fallback handles UI.
  }

  return result;
}
