// lib/pricing.ts
// Data layer for /revenue/pricing — reads from cross-property bridges where
// possible so the same calls work for Namkhan AND Donna.
// 2026-05-22: every helper now accepts an optional propertyId (defaults to
// PROPERTY_ID for backward compat). rate_inventory remains Namkhan-only at
// the schema level — returns 0 rows for Donna, which the heatmap renders as
// "no sellable rates in window".

import { supabase, PROPERTY_ID } from './supabase';

export interface RoomType {
  room_type_id: number;
  room_type_name: string;
}

export interface RatePlan {
  rate_id: string;
  rate_name: string | null;
  rate_type: string | null;
  is_active: boolean | null;
}

export interface RateInventoryRow {
  inventory_date: string;
  room_type_id: number;
  rate_id: string;
  rate: number;
  available_rooms: number | null;
  stop_sell: boolean | null;
  closed_to_arrival: boolean | null;
  closed_to_departure: boolean | null;
  minimum_stay: number | null;
}

export async function getRoomTypes(propertyId: number = PROPERTY_ID): Promise<RoomType[]> {
  const { data, error } = await supabase
    .from('v_room_types_all')
    .select('room_type_id, room_type_name')
    .eq('property_id', propertyId)
    .order('room_type_id');
  if (error) {
    console.error('[pricing] getRoomTypes', error);
    return [];
  }
  return (data ?? []) as RoomType[];
}

export async function getRatePlans(propertyId: number = PROPERTY_ID): Promise<RatePlan[]> {
  const { data, error } = await supabase
    .from('v_rate_plans_all')
    .select('rate_id, rate_name, rate_type, is_active')
    .eq('property_id', propertyId)
    .order('rate_name');
  if (error) {
    console.error('[pricing] getRatePlans', error);
    return [];
  }
  return (data ?? []) as RatePlan[];
}

export async function getRateInventory(
  fromDate: string,
  toDate: string,
  opts: { onlyActive?: boolean; propertyId?: number } = {},
): Promise<RateInventoryRow[]> {
  const pid = opts.propertyId ?? PROPERTY_ID;
  const { data, error } = await supabase
    .from('rate_inventory')
    .select('inventory_date, room_type_id, rate_id, rate, available_rooms, stop_sell, closed_to_arrival, closed_to_departure, minimum_stay')
    .eq('property_id', pid)
    .gte('inventory_date', fromDate)
    .lte('inventory_date', toDate)
    .gt('rate', 0);
  if (error) {
    console.error('[pricing] getRateInventory', error);
    return [];
  }
  return (data ?? []) as RateInventoryRow[];
}
