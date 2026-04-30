// app/operations/housekeeping/_data/amenityQueue.ts
// Gap-H6 — governance.amenity_budget + ops.amenity_loadouts.

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export interface AmenityQueueRow {
  room_no: string;
  description: string;          // "VIP loadout", "honeymoon turn-down"
  cost_estimate: number;        // USD
  agent_status: 'proposed' | 'approved' | 'fulfilled' | 'rejected';
}

export async function fetchAmenityQueue(): Promise<AmenityQueueRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('amenity_queue')
      .select('room_no, description, cost_estimate, agent_status')
      .eq('property_id', PROPERTY_ID)
      .eq('agent_status', 'proposed');
    if (error || !data || data.length === 0) return null;
    return data as AmenityQueueRow[];
  } catch {
    return null;
  }
}
