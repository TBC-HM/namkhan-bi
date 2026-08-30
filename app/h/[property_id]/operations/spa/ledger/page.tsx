// app/h/[property_id]/operations/spa/ledger/page.tsx
// PBS 2026-08-30 · Tenant wrapper for the Spa ledger view (L6).
// Without this the /h-prefixed Ledger link 404s for every property.

import { redirect, notFound } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import SpaLedgerPage from '@/app/operations/spa/ledger/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertySpaLedgerPage({ params, searchParams }: {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/spa/ledger');
  return <SpaLedgerPage searchParams={searchParams} propertyId={propertyId} />;
}
