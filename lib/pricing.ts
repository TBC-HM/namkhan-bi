// lib/pricing.ts
// Data layer for /revenue/pricing — reads public.rate_inventory + rate_plans + room_types.

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

export async function getRoomTypes(): Promise<RoomType[]> {
  const { data, error } = await supabase
    .from('room_types')
    .select('room_type_id, room_type_name')
    .order('room_type_id');
  if (error) {
    console.error('[pricing] getRoomTypes', error);
    return [];
  }
  return (data ?? []) as RoomType[];
}

export async function getRatePlans(): Promise<RatePlan[]> {
  const { data, error } = await supabase
    .from('rate_plans')
    .select('rate_id, rate_name, rate_type, is_active')
    .eq('property_id', PROPERTY_ID)
    .order('rate_name');
  if (error) {
    console.error('[pricing] getRatePlans', error);
    return [];
  }
  return (data ?? []) as RatePlan[];
}

export async function getRateInventory(fromDate: string, toDate: string, opts: { onlyActive?: boolean } = {}): Promise<RateInventoryRow[]> {
  let q = supabase
    .from('rate_inventory')
    .select('inventory_date, room_type_id, rate_id, rate, available_rooms, stop_sell, closed_to_arrival, closed_to_departure, minimum_stay')
    .eq('property_id', PROPERTY_ID)
    .gte('inventory_date', fromDate)
    .lte('inventory_date', toDate)
    .gt('rate', 0); // ignore zero placeholders
  const { data, error } = await q;
  if (error) {
    console.error('[pricing] getRateInventory', error);
    return [];
  }
  return (data ?? []) as RateInventoryRow[];
}
