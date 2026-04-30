// app/operations/housekeeping/_data/roomStatus.ts
// Gap-H1 — ops.room_status. Until table exists, returns null and the panel
// renders the "Data needed" overlay. Wire-up notes:
//   - Cloudbeds webhook `housekeeping.statuschanged` upserts here.
//   - Cloudbeds webhook `reservation.checkedout` inserts row with status='dirty'.
//   - Polling fallback: GET /housekeeping every 15 min.

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export type RoomStatusValue = 'clean' | 'dirty' | 'inspect' | 'ooo' | 'dnd' | 'inhouse';

export interface RoomStatusRow {
  room_no: string;
  status: RoomStatusValue;
  guest_name?: string | null;
  is_vip?: boolean;
  is_complaint?: boolean;
  arrival_eta?: string | null;       // HH:MM
  attendant_initial?: string | null;  // single letter, e.g. "M"
  category?: string | null;
}

export async function fetchRoomStatus(): Promise<RoomStatusRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('room_status')
      .select('room_no, status, guest_name, is_vip, is_complaint, arrival_eta, attendant_initial, category')
      .eq('property_id', PROPERTY_ID)
      .order('room_no', { ascending: true });
    if (error || !data || data.length === 0) return null;
    return data as RoomStatusRow[];
  } catch {
    return null;
  }
}
