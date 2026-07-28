// app/holding/supabase/page.tsx
// Holding-level Supabase Inventory page.
// Reads public.v_cockpit_inventory on the server and renders InventoryView.

import { fetchInventory } from '../../h/[property_id]/cockpit/supabase/lib/inventoryClient';
import InventoryView from '../../h/[property_id]/cockpit/supabase/components/InventoryView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HoldingSupabaseInventoryPage(): Promise<React.ReactElement> {
  const rows = await fetchInventory();
  return <InventoryView rows={rows} propertyName="Holding" />;
}
