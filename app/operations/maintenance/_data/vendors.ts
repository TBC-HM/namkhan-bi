// app/operations/maintenance/_data/vendors.ts
// Gap-M7 — ops.vendors + ops.v_vendor_scorecard_90d.

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export interface VendorScorecardRow {
  vendor: string;
  category: string;
  jobs_90d: number;
  on_time_pct: number;     // 0–100
  avg_cost: number;
  rework_pct: number;      // 0–100
  rating: 'A' | 'B' | 'C' | 'D';
}

export async function fetchVendorScorecard(): Promise<VendorScorecardRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('v_vendor_scorecard_90d')
      .select('vendor, category, jobs_90d, on_time_pct, avg_cost, rework_pct, rating')
      .eq('property_id', PROPERTY_ID)
      .order('on_time_pct', { ascending: false });
    if (error || !data || data.length === 0) return null;
    return data as VendorScorecardRow[];
  } catch {
    return null;
  }
}
