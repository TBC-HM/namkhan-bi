// app/operations/spa/_shared/data.ts
// Spa module v1 — server-side fetch helpers (brief spa-module-v1-slice-day-pass-tiers).
// Reads public.v_* bridges; degrades gracefully when bridges are missing.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const PROPERTY_TZ: Record<number, string> = {
  260955: 'Asia/Vientiane',
  1000001: 'Europe/Madrid',
};

export interface SpaBookingRow {
  booking_id: string; scheduled_at: string; ends_at: string | null; duration_min: number; guest_name: string | null;
  reservation_id: string | null; treatment_name: string; treatment_category: string | null; therapist_id: string | null;
  therapist_name: string | null; room_id: number | null; room_name: string | null; status: string; price: number | null;
  currency: string | null; posted_to_folio: boolean | null; cloudbeds_charge_id: string | null; notes: string | null;
  guest_email: string | null; guest_phone: string | null; confirmation_sent_at: string | null; reminder_sent_at: string | null;
}
export interface SpaTherapistRow { therapist_id: string; display_name: string; specialties: string[] | null; languages: string[] | null; is_active: boolean | null; }
export interface SpaRoomRow { room_id: number; name: string; room_type: string | null; couples_capable: boolean | null; is_active: boolean | null; }
export interface CatalogueRow {
  treatment_id: number; name: string; short_description: string | null; category: string | null; duration_min: number | null;
  price_usd: number | null; price_lak: number | null; oil_or_dry: string | null; couples_available: boolean | null;
  is_signature: boolean | null; is_active: boolean | null; display_order: number | null;
}
export interface SpaPassRow {
  pass_id: string; property_id: number; pass_type: 'day_pass' | 'package'; name: string; guest_name: string; guest_email: string | null;
  guest_phone: string | null; reservation_id: string | null; credits_total: number; credits_used: number; credits_remaining: number;
  valid_from: string; valid_until: string | null; price: number | null; currency: string | null; status: string; notes: string | null;
  created_at: string; last_redeemed_at: string | null; tier_id: number | null; tier_name: string | null; tier_code: string | null;
}
export interface SpaPassTierRow {
  tier_id: number; property_id: number; code: string; name: string; pass_type: string; credits_total: number;
  price: number; currency: string; valid_days: number; is_active: boolean; display_order: number;
}
export interface SpaPassRedemptionRow {
  redemption_id: string; pass_id: string; pass_name: string; pass_type: string; pass_guest: string; booking_id: string | null;
  booking_guest: string | null; booking_scheduled_at: string | null; treatment_name: string | null; credits: number; redeemed_at: string; note: string | null;
}
export interface TreatmentGuestsRow { id: string; label: string; is_in_house: boolean; }
export type Bridged<T> = { rows: T[]; bridgeMissing: boolean };

export function todayIsoAtProperty(pid: number): string {
  const tz = PROPERTY_TZ[pid] ?? 'UTC';
  return new Date().toLocaleString('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).slice(0, 10);
}
export function localTimeStr(utc: string, pid: number): string {
  const tz = PROPERTY_TZ[pid] ?? 'UTC';
  return new Date(utc).toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
}
export function localHour(utc: string, pid: number): number {
  const tz = PROPERTY_TZ[pid] ?? 'UTC';
  return parseInt(new Date(utc).toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', hour12: false }), 10);
}
export function dayWindowUtc(iso: string, pid: number): { fromUtc: string; toUtc: string } {
  const tz = PROPERTY_TZ[pid] ?? 'UTC';
  const start = new Date(`${iso}T00:00:00`);
  const utcStart = new Date(start.toLocaleString('en-US', { timeZone: tz }));
  const utcEnd = new Date(utcStart.getTime() + 86400000);
  return { fromUtc: utcStart.toISOString(), toUtc: utcEnd.toISOString() };
}

const sb = () => getSupabaseAdmin() as any;
async function bridge<T>(view: string, filter: (q: any) => any): Promise<Bridged<T>> {
  const { data, error } = await filter(sb().from(view));
  if (error?.code === '42P01' || error?.code === '42883') return { rows: [], bridgeMissing: true };
  return { rows: data ?? [], bridgeMissing: false };
}

export const getSpaPasses = (pid: number) => bridge<SpaPassRow>('v_spa_passes', q => q.select('*').eq('property_id', pid).order('created_at', { ascending: false }));
export const getSpaPassRedemptions = (pid: number, lim = 100) => bridge<SpaPassRedemptionRow>('v_spa_pass_redemptions', q => q.select('*').eq('property_id', pid).order('redeemed_at', { ascending: false }).limit(lim));
export const getSpaPassTiers = (pid: number) => bridge<SpaPassTierRow>('v_spa_pass_tiers', q => q.select('*').eq('property_id', pid).eq('is_active', true).order('display_order'));
export const getSpaBookingsForDay = async (pid: number, iso: string) => {
  const { fromUtc, toUtc } = dayWindowUtc(iso, pid);
  return bridge<SpaBookingRow>('v_spa_treatment_bookings', q => q.select('*').eq('property_id', pid).gte('scheduled_at', fromUtc).lt('scheduled_at', toUtc).order('scheduled_at'));
};
export const getSpaTherapists = (pid: number) => bridge<SpaTherapistRow>('v_spa_therapists', q => q.select('*').eq('property_id', pid).eq('is_active', true).order('display_name'));
export const getSpaRooms = (pid: number) => bridge<SpaRoomRow>('v_spa_rooms', q => q.select('*').eq('property_id', pid).eq('is_active', true).order('name'));
export const getSpaCatalogue = (pid: number) => bridge<CatalogueRow>('v_property_spa_treatments', q => q.select('*').eq('property_id', pid).eq('is_active', true).order('display_order'));
export const getSpaBookableGuests = async (pid: number, iso: string) => {
  const { data, error } = await sb().rpc('fn_spa_bookable_guests', { p_property_id: pid, p_day_iso: iso });
  if (error?.code === '42883') return { rows: [], bridgeMissing: true };
  return { rows: data ?? [], bridgeMissing: false };
};
export const getFolioSpaSellers = (pid: number) => bridge<any>('v_dept_top_seller_trend', q => q.select('*').eq('property_id', pid).eq('dept', 'spa').limit(5));
export const getFolioSpaTransactions = (pid: number, lim = 50) => bridge<any>('v_cloudbeds_folio_transactions', q => q.select('*').eq('property_id', pid).eq('category', 'spa').order('transaction_date', { ascending: false }).limit(lim));
export const getSpaDeliveryRecords = (pid: number, lim = 100) => bridge<any>('v_spa_delivery_log', q => q.select('*').eq('property_id', pid).order('created_at', { ascending: false }).limit(lim));
