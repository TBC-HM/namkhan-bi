// app/h/[property_id]/revenue/rateplans/dead/page.tsx
// Property-scoped delegate for /revenue/rateplans/dead.
// Namkhan canonical lives at /revenue/rateplans/dead — this route handles
// the explicit /h/<pid> case for Donna (and future properties).
// 2026-05-22.

import { redirect, notFound } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import DeadRatePlansPage from '@/app/revenue/rateplans/dead/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyDeadRatePlansPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/revenue/rateplans/dead');
  return <DeadRatePlansPage propertyId={propertyId} />;
}
