// app/h/[property_id]/cockpit/supabase/page.tsx
// Read-only governance surface. Reads public.v_cockpit_inventory and renders
// 3 tabs of tiles (KPIs / Containers / Graphs) with auto-flipping wired state.
// New rows added to kpi.{kpi_catalog,container_registry,graph_registry} appear
// on next refresh; inserts into kpi.wiring_registry flip a tile red → green.

import { notFound } from 'next/navigation';
import Page from '@/components/page/Page';
import { fetchInventory } from './lib/inventoryClient';
import InventoryTabs from './components/InventoryTabs';

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

  return (
    <Page
      eyebrow="IT · Cockpit"
      title={
        <>
          Supabase{' '}
          <em style={{ color: 'var(--accent, #a8854a)' }}>inventory</em>
        </>
      }
    >
      <InventoryTabs rows={rows} propertyName={propertyName(propertyId)} />
    </Page>
  );
}
