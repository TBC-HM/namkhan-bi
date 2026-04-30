// app/operations/maintenance/_data/tickets.ts
// Gap-M1 — ops.maintenance_tickets (table exists empty per arch doc).

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export type TicketPriority = 'urgent' | 'corrective' | 'cosmetic';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';

export interface MaintenanceTicketRow {
  id: string;
  title: string;
  asset?: string | null;
  room_no?: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  source: string;             // 'cloudbeds_note' | 'staff_form' | 'whatsapp' | 'agent'
  hours_to_sla_breach?: number | null;  // null = no breach risk
  created_at: string;
}

export async function fetchOpenTickets(): Promise<MaintenanceTicketRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('maintenance_tickets')
      .select('id, title, asset, room_no, priority, status, source, hours_to_sla_breach, created_at')
      .eq('property_id', PROPERTY_ID)
      .neq('status', 'resolved')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data || data.length === 0) return null;
    return data as MaintenanceTicketRow[];
  } catch {
    return null;
  }
}
