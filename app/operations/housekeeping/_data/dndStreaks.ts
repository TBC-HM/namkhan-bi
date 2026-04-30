// app/operations/housekeeping/_data/dndStreaks.ts
// Gap-H5 — ops.v_dnd_streaks (view derives from Gap-H1 ops.room_status).

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export interface DndStreakRow {
  room_no: string;
  consecutive_days: number;
  guest_segment?: string | null;       // "first-time", "repeat", ...
  flagged_for_welfare: boolean;        // policy flag at >=3 days
}

export async function fetchDndStreaks(): Promise<DndStreakRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('v_dnd_streaks')
      .select('room_no, consecutive_days, guest_segment, flagged_for_welfare')
      .eq('property_id', PROPERTY_ID)
      .gte('consecutive_days', 2);
    if (error || !data || data.length === 0) return null;
    return data as DndStreakRow[];
  } catch {
    return null;
  }
}
