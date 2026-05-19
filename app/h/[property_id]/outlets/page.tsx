// app/h/[property_id]/outlets/page.tsx
// NEW canonical F&B Outlets page (brief refactor-outlets-fnb-to-primitives v2).
// Composed exclusively from @/app/(cockpit)/_design via the OutletsView client
// orchestrator. Same component tree for Namkhan (260955) and Donna (1000001);
// Donna's views currently return 0 rows so tiles render 0s (no special branch).

import { notFound } from 'next/navigation';
import { fetchOutletsSnapshot } from './lib/outletsClient';
import OutletsView from './components/OutletsView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN_PROPERTY_ID = 260955;
const DONNA_PROPERTY_ID   = 1000001;

function propertyName(id: number): string {
  if (id === NAMKHAN_PROPERTY_ID) return 'Namkhan';
  if (id === DONNA_PROPERTY_ID)   return 'Donna';
  return 'Property';
}

export default async function OutletsPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();

  const snapshot = await fetchOutletsSnapshot(propertyId);

  return <OutletsView snapshot={snapshot} propertyName={propertyName(propertyId)} />;
}
