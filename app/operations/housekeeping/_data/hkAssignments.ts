// app/operations/housekeeping/_data/hkAssignments.ts
// Gap-H2 — ops.hk_assignments (attendant × shift × room × clean_minutes).

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export interface HkAssignmentRow {
  attendant: string;
  rooms_today: number;
  avg_min_per_clean: number;     // minutes
  variance_vs_target: number;    // +ve means slower than target
}

export async function fetchHkAssignments(): Promise<HkAssignmentRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('hk_assignments_today')
      .select('attendant, rooms_today, avg_min_per_clean, variance_vs_target')
      .eq('property_id', PROPERTY_ID);
    if (error || !data || data.length === 0) return null;
    return data as HkAssignmentRow[];
  } catch {
    return null;
  }
}
