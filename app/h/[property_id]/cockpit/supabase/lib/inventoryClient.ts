// app/h/[property_id]/cockpit/supabase/lib/inventoryClient.ts
// Single PostgREST read — public.v_cockpit_inventory is the source of truth
// for what KPIs / containers / graphs exist and which are wired.
//
// Future: when a real cockpit page first mounts a view, it should call:
//
//   await supabase.rpc('fn_mark_view_wired', {
//     p_view_name: 'kpi.v_revpar_daily',
//     p_page_route: '/h/[property_id]/revenue',
//     p_component_path: 'app/(cockpit)/h/[property_id]/revenue/cards/RevparCard.tsx',
//     p_wired_by: 'auto_mount',
//     p_notes: null,
//   });
//
// Later we'll add a CI script that greps for `from('v_…')` and batch-upserts.

import { supabase } from '@/lib/supabase';
import type { InventoryRow } from './types';

export async function fetchInventory(): Promise<InventoryRow[]> {
  const { data, error } = await supabase
    .from('v_cockpit_inventory')
    .select('*');
  if (error) throw new Error(`v_cockpit_inventory: ${error.message}`);
  return (data ?? []) as InventoryRow[];
}
