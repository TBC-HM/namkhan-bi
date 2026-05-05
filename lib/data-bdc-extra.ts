// lib/data-bdc-extra.ts — readers for promotions + 12-month reservations facts.
// Backed by public.v_bdc_promo_roi, v_bdc_country_real_12m, v_bdc_cancel_cohort_monthly,
// v_bdc_device_mix, v_bdc_purpose_mix, v_bdc_lead_time_buckets.

import { supabase } from './supabase';

const num = (v: any) => (v == null ? 0 : Number(v));
const numOrNull = (v: any) => (v == null ? null : Number(v));
const str = (v: any) => (v == null ? '' : String(v));

export interface BdcPromoRow {
  name: string;
  status: 'active' | 'inactive';
  discount_pct: number | null;
  bookable_from: string | null;
  bookable_to: string | null;
  bookings: number | null;
  room_nights: number | null;
  adr_usd: number | null;
  revenue_usd: number | null;
  canceled_room_nights: number | null;
  revenue_per_booking: number | null;
  cancel_rate_pct: number | null;
  rev_per_discount_pp: number | null;
}

export interface BdcCountryRealRow {
  country_iso2: string;
  bookings_ok: number;
  bookings_cancelled: number;
  bookings_total: number;
  confirm_rate_pct: number | null;
  avg_price_usd: number | null;
  avg_adr_usd: number | null;
  avg_los_nights: number | null;
  avg_lead_days: number | null;
  share_pct?: number;
}

export interface BdcCancelCohortRow {
  check_in_month: string;
  bookings_total: number;
  bookings_ok: number;
  bookings_cancelled: number;
  cancel_pct: number;
  revenue_ok_usd: number;
  revenue_lost_usd: number;
}

export interface BdcDeviceRow {
  device: string;
  bookings_total: number;
  bookings_ok: number;
  bookings_cancelled: number;
  confirm_rate_pct: number;
  avg_adr_usd: number | null;
  avg_lead_days: number | null;
}

export interface BdcPurposeRow {
  purpose: string;
  bookings_total: number;
  bookings_ok: number;
  avg_adr_usd: number | null;
  avg_los_nights: number | null;
}

export interface BdcLeadTimeRow {
  window_label: string;
  sort_min: number;
  bookings_total: number;
  bookings_ok: number;
  bookings_cancelled: number;
  cancel_pct: number;
  avg_adr_usd: number | null;
}

export async function getBdcPromos(): Promise<BdcPromoRow[]> {
  const { data, error } = await supabase.from('v_bdc_promo_roi').select('*');
  if (error) { console.error('getBdcPromos error', error); return []; }
  return ((data ?? []) as any[]).map((r) => ({
    name: str(r.name),
    status: r.status === 'active' ? 'active' : 'inactive',
    discount_pct: numOrNull(r.discount_pct),
    bookable_from: r.bookable_from ?? null,
    bookable_to: r.bookable_to ?? null,
    bookings: numOrNull(r.bookings),
    room_nights: numOrNull(r.room_nights),
    adr_usd: numOrNull(r.adr_usd),
    revenue_usd: numOrNull(r.revenue_usd),
    canceled_room_nights: numOrNull(r.canceled_room_nights),
    revenue_per_booking: numOrNull(r.revenue_per_booking),
    cancel_rate_pct: numOrNull(r.cancel_rate_pct),
    rev_per_discount_pp: numOrNull(r.rev_per_discount_pp),
  }));
}

export async function getBdcCountryReal12m(): Promise<BdcCountryRealRow[]> {
  const { data, error } = await supabase.from('v_bdc_country_real_12m').select('*');
  if (error) { console.error('getBdcCountryReal12m error', error); return []; }
  const rows = ((data ?? []) as any[]).map((r) => ({
    country_iso2: str(r.country_iso2),
    bookings_ok: num(r.bookings_ok),
    bookings_cancelled: num(r.bookings_cancelled),
    bookings_total: num(r.bookings_total),
    confirm_rate_pct: numOrNull(r.confirm_rate_pct),
    avg_price_usd: numOrNull(r.avg_price_usd),
    avg_adr_usd: numOrNull(r.avg_adr_usd),
    avg_los_nights: numOrNull(r.avg_los_nights),
    avg_lead_days: numOrNull(r.avg_lead_days),
  })) as BdcCountryRealRow[];
  // compute share_pct using ok bookings
  let totalOk = 0;
  for (const r of rows) totalOk += r.bookings_ok;
  for (const r of rows) r.share_pct = totalOk > 0 ? +(r.bookings_ok / totalOk * 100).toFixed(1) : 0;
  return rows;
}

export async function getBdcCancelCohort(): Promise<BdcCancelCohortRow[]> {
  const { data, error } = await supabase.from('v_bdc_cancel_cohort_monthly').select('*');
  if (error) { console.error('getBdcCancelCohort error', error); return []; }
  return ((data ?? []) as any[]).map((r) => ({
    check_in_month: String(r.check_in_month).slice(0, 10),
    bookings_total: num(r.bookings_total),
    bookings_ok: num(r.bookings_ok),
    bookings_cancelled: num(r.bookings_cancelled),
    cancel_pct: num(r.cancel_pct),
    revenue_ok_usd: num(r.revenue_ok_usd),
    revenue_lost_usd: num(r.revenue_lost_usd),
  }));
}

export async function getBdcDeviceMix(): Promise<BdcDeviceRow[]> {
  const { data, error } = await supabase.from('v_bdc_device_mix').select('*');
  if (error) { console.error('getBdcDeviceMix error', error); return []; }
  return ((data ?? []) as any[]).map((r) => ({
    device: str(r.device),
    bookings_total: num(r.bookings_total),
    bookings_ok: num(r.bookings_ok),
    bookings_cancelled: num(r.bookings_cancelled),
    confirm_rate_pct: num(r.confirm_rate_pct),
    avg_adr_usd: numOrNull(r.avg_adr_usd),
    avg_lead_days: numOrNull(r.avg_lead_days),
  }));
}

export async function getBdcPurposeMix(): Promise<BdcPurposeRow[]> {
  const { data, error } = await supabase.from('v_bdc_purpose_mix').select('*');
  if (error) { console.error('getBdcPurposeMix error', error); return []; }
  return ((data ?? []) as any[]).map((r) => ({
    purpose: str(r.purpose),
    bookings_total: num(r.bookings_total),
    bookings_ok: num(r.bookings_ok),
    avg_adr_usd: numOrNull(r.avg_adr_usd),
    avg_los_nights: numOrNull(r.avg_los_nights),
  }));
}

export async function getBdcLeadTimeBuckets(): Promise<BdcLeadTimeRow[]> {
  const { data, error } = await supabase.from('v_bdc_lead_time_buckets').select('*');
  if (error) { console.error('getBdcLeadTimeBuckets error', error); return []; }
  return ((data ?? []) as any[]).map((r) => ({
    window_label: str(r.window_label),
    sort_min: num(r.sort_min),
    bookings_total: num(r.bookings_total),
    bookings_ok: num(r.bookings_ok),
    bookings_cancelled: num(r.bookings_cancelled),
    cancel_pct: num(r.cancel_pct),
    avg_adr_usd: numOrNull(r.avg_adr_usd),
  }));
}
