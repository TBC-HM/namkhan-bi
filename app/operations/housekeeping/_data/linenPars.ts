// app/operations/housekeeping/_data/linenPars.ts
// Gap-H3 — ops.linen_pars + ops.laundry_cycle.

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export interface LinenParRow {
  item: string;            // "King sheet", "Bath towel", ...
  par_pct: number;         // 0–100
  cycle_hours: number;     // laundry turnaround
  forecast_demand: string; // human-readable, e.g. "Sun occ 96%"
}

export async function fetchLinenPars(): Promise<LinenParRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('linen_pars')
      .select('item, par_pct, cycle_hours, forecast_demand')
      .eq('property_id', PROPERTY_ID);
    if (error || !data || data.length === 0) return null;
    return data as LinenParRow[];
  } catch {
    return null;
  }
}
