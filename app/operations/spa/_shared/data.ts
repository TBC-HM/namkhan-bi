// app/operations/spa/_shared/data.ts
// Spa module v1 (build/spa-module, 2026-07-30) — server-side fetch helpers.
// AUDIT-FIRST: reads only public.v_* bridges. v_property_spa_treatments and
// v_dept_top_seller_trend are LIVE today; v_spa_treatment_bookings /
// v_spa_therapists / v_spa_rooms are PROPOSED (db/proposed/build-spa-module)
// — until that DDL is approved+applied every helper degrades to
// { bridgeMissing: true } instead of crashing the page.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const PROPERTY_TZ: Record<number, string> = {
  260955: 'Asia/Vientiane',
  1000001: 'Europe/Madrid',
};

export interface SpaBookingRow {
  booking_id: string;
  scheduled_at: string;
  ends_at: string | null;
  duration_min: number;
  guest_name: string | null;
  reservation_id: string | null;
  treatment_name: string;
  treatment_category: string | null;
  therapist_id: string | null;
  therapist_name: string | null;
  room_id: number | null;
  room_name: string | null;
  status: string;
  price: number | null;
  currency: string | null;
  posted_to_folio: boolean | null;
  cloudbeds_charge_id: string | null;
  notes: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  confirmation_sent_at: string | null;
  reminder_sent_at: string | null;
}

export interface SpaTherapistRow {
  therapist_id: string;
  display_name: string;
  specialties: string[] | null;
  languages: string[] | null;
  is_active: boolean | null;
}

export interface SpaRoomRow {
  room_id: number;
  name: string;
  room_type: string | null;
  couples_capable: boolean | null;
  is_active: boolean | null;
}

export interface CatalogueRow {
  treatment_id: number;
  name: string;
  short_description: string | null;
  category: string | null;
  duration_min: number | null;
  price_usd: number | null;
  price_lak: number | null;
  oil_or_dry: string | null;
  couples_available: boolean | null;
  is_signature: boolean | null;
  is_active: boolean | null;
  display_order: number | null;
}

export interface SpaPassRow {
  pass_id: string;
  property_id: number;
  pass_type: 'day_pass' | 'package';
  name: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  reservation_id: string | null;
  credits_total: number;
  credits_used: number;
  credits_remaining: number;
  valid_from: string;
  valid_until: string | null;
  price: number | null;
  currency: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  last_redeemed_at: string | null;
  tier_id: number | null;
  tier_name: string | null;
  tier_code: string | null;
}

export interface SpaPassTierRow {
  tier_id: number;
  property_id: number;
  code: string;
  name: string;
  pass_type: string;
  credits_total: number;
  price: number;
  currency: string;
  valid_days: number;
  is_active: boolean;
  display_order: number;
}

export interface SpaPassRedemptionRow {
  redemption_id: string;
  pass_id: string;
  pass_name: string;
  pass_type: string;
  pass_guest: string;
  booking_id: string | null;
  booking_guest: string | null;
  booking_scheduled_at: string | null;
  treatment_name: string | null;
  credits: number;
  redeemed_at: string;
  note: string | null;
}

export type Bridged<T> = { rows: T[]; bridgeMissing: boolean };

export interface TreatmentGuestsRow {
  id: string;
  label: string;
  is_in_house: boolean;
}