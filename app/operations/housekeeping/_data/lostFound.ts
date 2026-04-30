// app/operations/housekeeping/_data/lostFound.ts
// Gap-H4 — ops.lost_and_found.

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export interface LostFoundRow {
  id: string;
  item: string;
  room_no: string;
  found_at: string;        // ISO date
  status: 'unclaimed' | 'returned' | 'donated';
}

export async function fetchLostFound(): Promise<LostFoundRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('lost_and_found')
      .select('id, item, room_no, found_at, status')
      .eq('property_id', PROPERTY_ID)
      .order('found_at', { ascending: false })
      .limit(20);
    if (error || !data || data.length === 0) return null;
    return data as LostFoundRow[];
  } catch {
    return null;
  }
}
