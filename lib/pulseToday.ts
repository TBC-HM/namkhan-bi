// lib/pulseToday.ts
// PBS 2026-05-09 (new task): "On the page Pulse we need to see the sales of
// today / cancellations of today and when I hover any of them I see the
// details: source, roomnights, ADR/total, rate plan per reservation".
// Server fetcher reading public.reservations directly via service-role.

import { supabase } from '@/lib/supabase';

export interface PulseTodayRow {
  reservation_id: string | null;
  booking_id: string | null;
  guest_name: string | null;
  source: string | null;
  source_name: string | null;
  rate_plan: string | null;
  nights: number | null;
  total_amount: number | null;
  booking_date: string | null;
  cancellation_date: string | null;
  status: string | null;
}

export interface PulseTodayResult {
  booked: PulseTodayRow[];
  cancelled: PulseTodayRow[];
  bookedRevenue: number;
  cancelledRevenue: number;
}

const FIELDS =
  'reservation_id, booking_id, guest_name, source, source_name, rate_plan, nights, total_amount, booking_date, cancellation_date, status';

export async function getPulseToday(): Promise<PulseTodayResult> {
  const today = new Date().toISOString().slice(0, 10);

  const [bookedRes, cancelledRes] = await Promise.all([
    supabase
      .from('reservations')
      .select(FIELDS)
      .gte('booking_date', `${today} 00:00:00`)
      .lt('booking_date', `${today} 23:59:59`)
      .order('booking_date', { ascending: false })
      .limit(50),
    supabase
      .from('reservations')
      .select(FIELDS)
      .gte('cancellation_date', `${today} 00:00:00`)
      .lt('cancellation_date', `${today} 23:59:59`)
      .order('cancellation_date', { ascending: false })
      .limit(50),
  ]);

  const booked = (bookedRes.data ?? []) as PulseTodayRow[];
  const cancelled = (cancelledRes.data ?? []) as PulseTodayRow[];

  const bookedRevenue = booked.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const cancelledRevenue = cancelled.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  return { booked, cancelled, bookedRevenue, cancelledRevenue };
}
