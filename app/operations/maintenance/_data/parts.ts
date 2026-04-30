// app/operations/maintenance/_data/parts.ts
// Gap-M6 — ops.spare_parts.

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export interface SparePartRow {
  sku: string;
  name: string;
  on_hand: number;
  reorder_at: number;
  lead_time_days: number;
  unit_cost: number;
}

export async function fetchSpareParts(): Promise<SparePartRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('spare_parts')
      .select('sku, name, on_hand, reorder_at, lead_time_days, unit_cost')
      .eq('property_id', PROPERTY_ID)
      .order('on_hand', { ascending: true })
      .limit(40);
    if (error || !data || data.length === 0) return null;
    return data as SparePartRow[];
  } catch {
    return null;
  }
}
