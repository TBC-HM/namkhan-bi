// app/h/[property_id]/cockpit/supabase/page.tsx
// v2: composes from @/app/(cockpit)/_design only. No bespoke tiles/grids.
// Reads public.v_cockpit_inventory once on the server, hands the rows to
// the client orchestrator which renders DashboardPage + Container + KpiTile + Drawer.

import { notFound } from 'next/navigation';
import { fetchInventory } from './lib/inventoryClient';
import InventoryView from './components/InventoryView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN_PROPERTY_ID = 260955;
const DONNA_PROPERTY_ID   = 1000001;

function propertyName(id: number): string {
  if (id === NAMKHAN_PROPERTY_ID) return 'Namkhan';
  if (id === DONNA_PROPERTY_ID)   return 'Donna';
  return 'Property';
}

export default async function SupabaseInventoryPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();

  const rows = await fetchInventory();

  return <InventoryView rows={rows} propertyName={propertyName(propertyId)} />;
}
