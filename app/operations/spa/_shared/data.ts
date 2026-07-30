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

export interface FolioSellerRow {
  description: string;
  total_revenue_usd: number;
  total_units: number;
  last_sold: string | null;
}

export interface Bridged<T> { rows: T[]; bridgeMissing: boolean; }

/** UTC window [from, to) covering one local calendar day at the property. */
export function dayWindowUtc(dayIso: string, propertyId: number): { fromUtc: string; toUtc: string } {
  const tz = PROPERTY_TZ[propertyId] ?? 'Asia/Vientiane';
  // offset at local noon of that day (avoids DST edge at midnight)
  const noonUtc = new Date(`${dayIso}T12:00:00Z`);
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = dtf.formatToParts(noonUtc).reduce<Record<string, string>>((a, p) => { a[p.type] = p.value; return a; }, {});
  const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  const offsetMin = Math.round((localAsUtc - noonUtc.getTime()) / 60000);
  const startUtc = Date.parse(`${dayIso}T00:00:00Z`) - offsetMin * 60000;
  return {
    fromUtc: new Date(startUtc).toISOString(),
    toUtc: new Date(startUtc + 24 * 3600 * 1000).toISOString(),
  };
}

export function localTimeStr(iso: string, propertyId: number): string {
  const tz = PROPERTY_TZ[propertyId] ?? 'Asia/Vientiane';
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

export function localHour(iso: string, propertyId: number): number {
  return Number(localTimeStr(iso, propertyId).slice(0, 2));
}

export function todayIsoAtProperty(propertyId: number): string {
  const tz = PROPERTY_TZ[propertyId] ?? 'Asia/Vientiane';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
  return parts; // en-CA gives YYYY-MM-DD
}

export async function getSpaBookingsForDay(propertyId: number, dayIso: string): Promise<Bridged<SpaBookingRow>> {
  const sb = getSupabaseAdmin();
  const { fromUtc, toUtc } = dayWindowUtc(dayIso, propertyId);
  const { data, error } = await (sb as any)
    .from('v_spa_treatment_bookings')
    .select('booking_id, scheduled_at, ends_at, duration_min, guest_name, reservation_id, treatment_name, treatment_category, therapist_id, therapist_name, room_id, room_name, status, price, currency, posted_to_folio, cloudbeds_charge_id, notes')
    .eq('property_id', propertyId)
    .gte('scheduled_at', fromUtc).lt('scheduled_at', toUtc)
    .order('scheduled_at', { ascending: true });
  if (error) return { rows: [], bridgeMissing: true };
  return { rows: (data ?? []) as SpaBookingRow[], bridgeMissing: false };
}

export async function getSpaDeliveryRecords(propertyId: number, sinceIso: string): Promise<Bridged<SpaBookingRow>> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('v_spa_treatment_bookings')
    .select('booking_id, scheduled_at, ends_at, duration_min, guest_name, reservation_id, treatment_name, treatment_category, therapist_id, therapist_name, room_id, room_name, status, price, currency, posted_to_folio, cloudbeds_charge_id, notes')
    .eq('property_id', propertyId)
    .in('status', ['completed', 'no_show', 'cancelled'])
    .gte('scheduled_at', `${sinceIso}T00:00:00Z`)
    .order('scheduled_at', { ascending: false })
    .limit(500);
  if (error) return { rows: [], bridgeMissing: true };
  return { rows: (data ?? []) as SpaBookingRow[], bridgeMissing: false };
}

export async function getSpaTherapists(propertyId: number): Promise<Bridged<SpaTherapistRow>> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('v_spa_therapists')
    .select('therapist_id, display_name, specialties, languages, is_active')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .order('display_name');
  if (error) return { rows: [], bridgeMissing: true };
  return { rows: (data ?? []) as SpaTherapistRow[], bridgeMissing: false };
}

export async function getSpaRooms(propertyId: number): Promise<Bridged<SpaRoomRow>> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('v_spa_rooms')
    .select('room_id, name, room_type, couples_capable, is_active')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .order('display_order');
  if (error) return { rows: [], bridgeMissing: true };
  return { rows: (data ?? []) as SpaRoomRow[], bridgeMissing: false };
}

/** LIVE bridge — property.spa_treatments via v_property_spa_treatments. */
export async function getSpaCatalogue(propertyId: number): Promise<CatalogueRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('v_property_spa_treatments')
    .select('treatment_id, name, short_description, category, duration_min, price_usd, price_lak, oil_or_dry, couples_available, is_signature, is_active, display_order')
    .eq('property_id', propertyId)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('name');
  if (error) return [];
  return (data ?? []) as CatalogueRow[];
}

/** LIVE gold view — what the folio actually sold under Other Operated / Spa. */
export async function getFolioSpaSellers(propertyId: number, limit = 100): Promise<FolioSellerRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('v_dept_top_seller_trend')
    .select('description, total_revenue_usd, total_units, last_sold')
    .eq('property_id', propertyId)
    .eq('usali_dept', 'Other Operated')
    .eq('usali_subdept', 'Spa')
    .order('total_revenue_usd', { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    description: String(r.description ?? '—'),
    total_revenue_usd: Number(r.total_revenue_usd ?? 0),
    total_units: Number(r.total_units ?? 0),
    last_sold: r.last_sold ? String(r.last_sold) : null,
  }));
}

export interface FolioTxnRow {
  transaction_id: string;
  transaction_date: string;
  local_str: string | null;
  description: string;
  amount: number;
  currency: string;
  guest_name: string | null;
  room_name: string | null;
  user_name: string | null;
}

/** LIVE enriched folio lines (Spa slice) — the current de-facto delivery record. */
export async function getFolioSpaTransactions(propertyId: number, limit = 300): Promise<FolioTxnRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('v_fnb_raw_txn_enriched')
    .select('transaction_id, transaction_date, local_laos_str, description, amount, currency, guest_name, room_name, user_name')
    .eq('property_id', propertyId)
    .eq('usali_dept', 'Other Operated')
    .eq('usali_subdept', 'Spa')
    .order('transaction_date', { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    transaction_id: String(r.transaction_id),
    transaction_date: String(r.transaction_date),
    local_str: r.local_laos_str ? String(r.local_laos_str) : null,
    description: String(r.description ?? '—'),
    amount: Number(r.amount ?? 0),
    currency: String(r.currency ?? 'USD'),
    guest_name: r.guest_name ? String(r.guest_name) : null,
    room_name: r.room_name ? String(r.room_name) : null,
    user_name: r.user_name ? String(r.user_name) : null,
  }));
}
