// lib/compiler/roomPricing.ts
// Real-rate room pricing for the retreat compiler.
// Pulls per-room median (+ min/max + observation count) from public.rate_inventory
// for the chosen window × room types × rate plan.
//
// Default rate_plan_id = 413802 = "Non Refundable" (cleanest data, 153 days × 10 rooms).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const DEFAULT_RATE_PLAN_ID = 413802; // Non Refundable

export interface RoomTypeOption {
  room_type_id: number;
  room_type_name: string;
  max_guests: number | null;
  quantity: number | null;
}

export interface RatePlanOption {
  rate_id: number;
  rate_name: string;
  rate_type: string | null;
}

export interface RoomRateStat {
  room_type_id: number;
  room_type_name: string;
  rate_id: number;
  rate_name: string;
  median_usd: number;
  min_usd: number;
  max_usd: number;
  days_with_rate: number;
  window_from: string;
  window_to: string;
}

export async function listRoomTypes(): Promise<RoomTypeOption[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('room_types')
    .select('room_type_id,room_type_name,max_guests,quantity')
    .gt('quantity', 0)
    .order('room_type_name');
  if (error) throw error;
  return (data ?? []) as RoomTypeOption[];
}

export async function listNrfRatePlans(): Promise<RatePlanOption[]> {
  const admin = getSupabaseAdmin();
  // Direct rates only (NRF / BAR), strip OTA-only / member / GDS variants for clarity.
  const { data, error } = await admin
    .from('rate_plans')
    .select('rate_id,rate_name,rate_type')
    .eq('is_active', true)
    .or('rate_name.ilike.%non refund%,rate_name.ilike.%non-refund%,rate_name.ilike.%nrf%,rate_name.ilike.%flex%,rate_name.ilike.%bar%')
    .order('rate_name');
  if (error) throw error;
  // Push "Non Refundable" (clean) to the top
  const rows = (data ?? []) as RatePlanOption[];
  return rows.sort((a, b) => {
    const aDefault = a.rate_id === DEFAULT_RATE_PLAN_ID ? -1 : 0;
    const bDefault = b.rate_id === DEFAULT_RATE_PLAN_ID ? -1 : 0;
    return aDefault - bDefault;
  });
}

/**
 * Pull median/min/max/count for each room type within the window for the
 * selected rate plan. We use a single aggregating SQL via .from with
 * percentile_cont — but that needs a function or RPC. Simpler in v1:
 * fetch raw rates and aggregate in JS (n is small: ~150 days × ~10 rooms).
 */
export async function getRoomRateStats(args: {
  roomTypeIds: number[];
  ratePlanId?: number;
  windowFrom: string; // YYYY-MM-DD
  windowTo: string;   // YYYY-MM-DD
}): Promise<RoomRateStat[]> {
  const admin = getSupabaseAdmin();
  const ratePlanId = args.ratePlanId ?? DEFAULT_RATE_PLAN_ID;

  if (args.roomTypeIds.length === 0) return [];

  const [{ data: roomRows }, { data: planRows }, { data: invRows }] = await Promise.all([
    admin.from('room_types').select('room_type_id,room_type_name').in('room_type_id', args.roomTypeIds),
    admin.from('rate_plans').select('rate_id,rate_name').eq('rate_id', ratePlanId).maybeSingle()
      .then(r => ({ data: r.data ? [r.data] : [] })),
    admin
      .from('rate_inventory')
      .select('room_type_id,rate')
      .in('room_type_id', args.roomTypeIds)
      .eq('rate_id', ratePlanId)
      .gte('inventory_date', args.windowFrom)
      .lte('inventory_date', args.windowTo)
      .or('stop_sell.is.null,stop_sell.eq.false')
      .gt('rate', 0)
      .limit(20000),
  ]);

  const roomMap = new Map<number, string>(
    (roomRows ?? []).map(r => [r.room_type_id, r.room_type_name]),
  );
  const planName = (planRows[0] as any)?.rate_name ?? 'Unknown rate plan';

  // Aggregate
  const buckets = new Map<number, number[]>();
  for (const r of invRows ?? []) {
    const k = (r as any).room_type_id as number;
    const v = Number((r as any).rate);
    if (!isFinite(v)) continue;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(v);
  }

  const stats: RoomRateStat[] = [];
  for (const id of args.roomTypeIds) {
    const arr = (buckets.get(id) ?? []).sort((a, b) => a - b);
    if (arr.length === 0) {
      stats.push({
        room_type_id: id,
        room_type_name: roomMap.get(id) ?? 'Unknown',
        rate_id: ratePlanId,
        rate_name: planName,
        median_usd: 0, min_usd: 0, max_usd: 0,
        days_with_rate: 0,
        window_from: args.windowFrom, window_to: args.windowTo,
      });
      continue;
    }
    const median = arr.length % 2 === 0
      ? (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2
      : arr[Math.floor(arr.length / 2)];
    stats.push({
      room_type_id: id,
      room_type_name: roomMap.get(id) ?? 'Unknown',
      rate_id: ratePlanId,
      rate_name: planName,
      median_usd: Math.round(median),
      min_usd: Math.round(arr[0]),
      max_usd: Math.round(arr[arr.length - 1]),
      days_with_rate: arr.length,
      window_from: args.windowFrom,
      window_to: args.windowTo,
    });
  }
  return stats;
}
