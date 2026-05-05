// lib/compiler/variants.ts
// v1.1 — Real-rate variant builder.
//
// Inputs: parsed spec + offer config (window + room types + rate plan).
// Output: one variant per selected room type, priced as
//   median(rate_inventory) × nights × room_count
//   + board (per pax/night, from pricelist)
//   + program (activities/spa/ceremonies, from pricelist)
//   + transport (airport transfer, from pricelist)
//
// Variant intensity (light/medium/full) toggles which extras are bundled.
// Default intensity = 'medium' for all room variants; operator can edit later.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { ParsedSpec } from './parse';
import { getRoomRateStats, DEFAULT_RATE_PLAN_ID, type RoomRateStat } from './roomPricing';

export interface PricelistRow {
  sku: string;
  item_name: string;
  source_table: string;
  sell_price_usd: number;
  cost_lak: number;
  margin_pct: number;
  margin_floor_pct: number;
  tier_visibility: string[];
  usali_category: string | null;
}

export interface VariantDay {
  day: number;
  title: string;
  am: string[];
  pm: string[];
  eve: string[];
  skus: string[];
}

export interface BuiltVariant {
  label: string;
  room_category: string;
  activity_intensity: 'light' | 'medium' | 'full';
  fnb_mode: 'BB' | 'HB' | 'FB';
  total_usd: number;
  per_pax_usd: number;
  margin_pct: number;
  occ_assumption_pct: number;
  day_structure: VariantDay[];
  usali_split: Record<string, number>;
  bookable_rooms: any[];
  bookable_boards: any[];
  bookable_program: any[];
  bookable_addons: any[];
  recommended: boolean;
  pricing_breakdown: PricingBreakdown;
  // Surface the rate decision so the operator sees what fed the price
  rate_plan_id: number;
  rate_plan_name: string;
  room_rate_median_usd: number;
  room_rate_min_usd: number;
  room_rate_max_usd: number;
  room_rate_days: number;
}

export interface PricingBreakdown {
  rooms: { qty: number; unit_usd: number; line_usd: number; rate_source: string; rate_min: number; rate_max: number; rate_days: number };
  board: { qty: number; unit_usd: number; line_usd: number; sku: string };
  program: { sku: string; name: string; qty: number; unit_usd: number; line_usd: number }[];
  transport: { qty: number; unit_usd: number; line_usd: number };
  total_usd: number;
  per_pax_usd: number;
}

const FNB_BY_INTENSITY: Record<'light' | 'medium' | 'full', { sku: string; mode: 'BB' | 'HB' | 'FB' }> = {
  light:  { sku: 'NMK-FNB-BB', mode: 'BB' },
  medium: { sku: 'NMK-FNB-HB', mode: 'HB' },
  full:   { sku: 'NMK-FNB-FB', mode: 'FB' },
};

export async function loadPricelist(): Promise<PricelistRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .schema('pricing')
    .from('pricelist')
    .select('sku,item_name,source_table,sell_price_usd,cost_lak,margin_pct,margin_floor_pct,tier_visibility,usali_category')
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []) as PricelistRow[];
}

function pick(rows: PricelistRow[], sku: string): PricelistRow | undefined {
  return rows.find(r => r.sku === sku);
}

function dayStructure(spec: ParsedSpec, programSkus: string[]): VariantDay[] {
  const days: VariantDay[] = [];
  for (let d = 1; d <= spec.duration_nights + 1; d++) {
    const isFirst = d === 1;
    const isLast  = d === spec.duration_nights + 1;
    const isMid   = !isFirst && !isLast;
    const am: string[] = [];
    const pm: string[] = [];
    const eve: string[] = [];
    const skus: string[] = [];

    if (isFirst) {
      am.push('Arrival · airport transfer');
      pm.push('Welcome ceremony · property orientation');
      eve.push('Sunset meditation by the river');
      skus.push('NMK-TRP-AIR', 'NMK-ACT-SBT');
    } else if (isLast) {
      am.push('Closing meditation · departure brief');
      pm.push('Departure transfer');
      skus.push('NMK-TRP-AIR');
    } else if (isMid) {
      const prog = programSkus[(d - 2) % Math.max(1, programSkus.length)];
      am.push(spec.theme === 'mindfulness' ? 'Morning meditation' : 'Slow morning · breakfast on the deck');
      pm.push(prog ? `Program block · ${prog}` : 'Free time · pool · river walk');
      eve.push(spec.lunar_required && d === Math.ceil((spec.duration_nights + 1) / 2)
        ? 'Full moon ceremony'
        : 'Sound bath');
      if (prog) skus.push(prog);
      if (spec.lunar_required && d === Math.ceil((spec.duration_nights + 1) / 2)) skus.push('NMK-ACT-FMC');
      else skus.push('NMK-ACT-SBT');
    }

    days.push({
      day: d,
      title: isFirst ? 'Arrival' : isLast ? 'Departure' : `Day ${d}`,
      am, pm, eve, skus,
    });
  }
  return days;
}

function buildOneFromRoom(
  rows: PricelistRow[],
  spec: ParsedSpec,
  label: string,
  roomStat: RoomRateStat,
  roomMaxGuests: number,
  intensity: 'light' | 'medium' | 'full',
  recommended: boolean,
): BuiltVariant {
  const board = pick(rows, FNB_BY_INTENSITY[intensity].sku);
  const program: PricelistRow[] = [];
  const programCount = intensity === 'light' ? 2 : intensity === 'medium' ? 4 : 6;
  const candidatePool = ['NMK-ACT-MED','NMK-ACT-SBT','NMK-ACT-FMC','NMK-ACT-ALM','NMK-SPA-MAS','NMK-WSP-WEA','NMK-SPA-PKG'];
  for (const sku of candidatePool) {
    if (program.length >= programCount) break;
    const r = pick(rows, sku);
    if (!r) continue;
    if (program.find(p => p.sku === r.sku)) continue;
    program.push(r);
  }

  const nights = spec.duration_nights;
  const pax = spec.pax;
  // Number of rooms to cover the party — round up by max_guests of this room type.
  const roomCount = Math.max(1, Math.ceil(pax / Math.max(1, roomMaxGuests)));

  const roomLine    = roomStat.median_usd * nights * roomCount;
  const boardLine   = (board?.sell_price_usd ?? 0) * nights * pax;
  const programLine = program.reduce((s, p) => s + p.sell_price_usd * pax, 0);
  const transferUnit = pick(rows, 'NMK-TRP-AIR')?.sell_price_usd ?? 0;
  const transferLine = transferUnit * pax * 2; // arrival + departure

  const total = Math.round(roomLine + boardLine + programLine + transferLine);
  const perPax = Math.round(total / pax);

  // Margin estimate — rooms at 60% (Cloudbeds floor), board/program use pricelist margins.
  const lineWeights = [
    { weight: roomLine, margin: 60 },
    { weight: boardLine, margin: board?.margin_pct ?? 70 },
    ...program.map(p => ({ weight: p.sell_price_usd * pax, margin: p.margin_pct })),
    { weight: transferLine, margin: 35 },
  ];
  const totalWeight = lineWeights.reduce((s, l) => s + l.weight, 0) || 1;
  const blendedMargin = lineWeights.reduce((s, l) => s + l.margin * (l.weight / totalWeight), 0);

  const usali = {
    rooms: Math.round(((roomLine / Math.max(1, total)) * 1000)) / 10,
    fnb: Math.round(((boardLine / Math.max(1, total)) * 1000)) / 10,
    program: Math.round(((programLine / Math.max(1, total)) * 1000)) / 10,
    transport: Math.round(((transferLine / Math.max(1, total)) * 1000)) / 10,
  };

  const programSkus = program.map(p => p.sku);
  const days = dayStructure(spec, programSkus);

  const breakdown: PricingBreakdown = {
    rooms: {
      qty: nights * roomCount,
      unit_usd: roomStat.median_usd,
      line_usd: roomLine,
      rate_source: `${roomStat.rate_name} · median over ${roomStat.days_with_rate} days`,
      rate_min: roomStat.min_usd,
      rate_max: roomStat.max_usd,
      rate_days: roomStat.days_with_rate,
    },
    board: {
      qty: nights * pax,
      unit_usd: board?.sell_price_usd ?? 0,
      line_usd: boardLine,
      sku: board?.sku ?? FNB_BY_INTENSITY[intensity].sku,
    },
    program: program.map(p => ({
      sku: p.sku, name: p.item_name, qty: pax,
      unit_usd: p.sell_price_usd, line_usd: p.sell_price_usd * pax,
    })),
    transport: {
      qty: pax * 2,
      unit_usd: transferUnit,
      line_usd: transferLine,
    },
    total_usd: total,
    per_pax_usd: perPax,
  };

  return {
    label,
    room_category: roomStat.room_type_name,
    activity_intensity: intensity,
    fnb_mode: FNB_BY_INTENSITY[intensity].mode,
    total_usd: total,
    per_pax_usd: perPax,
    margin_pct: Math.round(blendedMargin * 10) / 10,
    occ_assumption_pct: 100,
    day_structure: days,
    usali_split: usali,
    bookable_rooms: [{
      room_type_id: roomStat.room_type_id,
      name: roomStat.room_type_name,
      median_usd_per_night: roomStat.median_usd,
      rate_plan: roomStat.rate_name,
      window: { from: roomStat.window_from, to: roomStat.window_to },
    }],
    bookable_boards: board ? [{ sku: board.sku, mode: FNB_BY_INTENSITY[intensity].mode, per_pax_per_night_usd: board.sell_price_usd }] : [],
    bookable_program: program.map(p => ({ sku: p.sku, name: p.item_name, per_pax_usd: p.sell_price_usd, default_on: true })),
    bookable_addons: [],
    recommended,
    pricing_breakdown: breakdown,
    rate_plan_id: roomStat.rate_id,
    rate_plan_name: roomStat.rate_name,
    room_rate_median_usd: roomStat.median_usd,
    room_rate_min_usd: roomStat.min_usd,
    room_rate_max_usd: roomStat.max_usd,
    room_rate_days: roomStat.days_with_rate,
  };
}

/**
 * Build one variant per selected room type. The intensity ladder (light → medium → full)
 * is folded into the room choice — bigger rooms get fuller programs by default.
 *
 * Falls back to the v1 hardcoded behaviour ONLY if spec.offer is missing.
 */
export async function buildVariants(spec: ParsedSpec): Promise<BuiltVariant[]> {
  const rows = await loadPricelist();
  const offer = spec.offer;

  // No offer config → can't build with real rates. Return empty so the UI prompts
  // the operator to fill it in.
  if (!offer || offer.room_type_ids.length === 0) {
    return [];
  }

  const stats = await getRoomRateStats({
    roomTypeIds: offer.room_type_ids,
    ratePlanId: offer.rate_plan_id ?? DEFAULT_RATE_PLAN_ID,
    windowFrom: offer.window_from,
    windowTo: offer.window_to,
  });

  // Look up max_guests per room so we know how many rooms to allocate
  const admin = getSupabaseAdmin();
  const { data: roomMeta } = await admin
    .from('room_types')
    .select('room_type_id,max_guests')
    .in('room_type_id', offer.room_type_ids);
  const maxGuestsMap = new Map<number, number>(
    (roomMeta ?? []).map((r: any) => [r.room_type_id, r.max_guests ?? 2]),
  );

  // Sort rooms by median rate ASC so cheapest = light, most expensive = full
  const sortedStats = [...stats].sort((a, b) => a.median_usd - b.median_usd);
  const intensityLadder: ('light' | 'medium' | 'full')[] = ['light', 'medium', 'full'];

  const variants: BuiltVariant[] = sortedStats.map((stat, i) => {
    const intensity =
      sortedStats.length === 1 ? 'medium' :
      sortedStats.length === 2 ? (i === 0 ? 'light' : 'full') :
      intensityLadder[Math.min(i, intensityLadder.length - 1)];
    return buildOneFromRoom(
      rows,
      spec,
      String.fromCharCode(65 + i), // A, B, C, ...
      stat,
      maxGuestsMap.get(stat.room_type_id) ?? 2,
      intensity,
      i === Math.floor(sortedStats.length / 2), // middle is recommended
    );
  });

  return variants;
}
