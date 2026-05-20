// app/h/[property_id]/revenue/compset/page.tsx
// 2026-05-20: property-aware compset. Single source of truth at
// /app/revenue/compset/page.tsx — same JSX renders for both Namkhan + Donna.
// Donna's compset views return 0 rows; the page falls through to empty states.

import { notFound } from 'next/navigation';
import CompsetBody from '@/app/revenue/compset/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyCompsetPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return <CompsetBody propertyId={propertyId} />;
}
