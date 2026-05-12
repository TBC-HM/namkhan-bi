// lib/pulseExtended.ts
// D5: extra Pulse KPIs not in mv_kpi_daily — Cancel%, No-Show%, Lead Time (days), ALOS.
// Queries `reservations` directly. Each metric is wrapped in try/catch so a missing column
// or RLS denial returns null and the Pulse page falls back to the mockup placeholder value.
//
// 2026-05-12 audit: actual columns in public.reservations view (over pms.reservations):
//   status            text   — values: confirmed / checked_in / checked_out / canceled / no_show
//   booking_date      timestamptz — when the booking was made (NOT created_at, which is row insert)
//   check_in_date     date  (NOT arrival_date — was the bug)
//   check_out_date    date
//   nights            int
//   property_id       bigint
// Previous code used `arrival_date` / `created_at` → query silently returned nulls.

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
    // Pull reservations whose check_in_date overlaps the period window.
    const { data, error } = await supabase
      .from('reservations')
      .select('status, booking_date, check_in_date, nights')
      .eq('property_id', PROPERTY_ID)
      .gte('check_in_date', period.from)
      .lte('check_in_date', period.to);

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
      // pms.reservations.status uses 'canceled' (one L) — startsWith catches both 'canceled' and 'cancelled'
      if (status.startsWith('cancel')) cancelled++;
      if (status === 'no_show' || status === 'no-show') noShow++;

      const booked = r.booking_date ? new Date(String(r.booking_date)) : null;
      const arrival = r.check_in_date ? new Date(String(r.check_in_date)) : null;
      if (booked && arrival && !isNaN(booked.getTime()) && !isNaN(arrival.getTime())) {
        const days = Math.max(0, Math.round((arrival.getTime() - booked.getTime()) / 86_400_000));
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
