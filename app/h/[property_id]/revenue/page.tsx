// app/h/[property_id]/revenue/page.tsx
// 2026-05-21: delegate to the shared primitives-based Revenue HoD page
// (app/revenue/page.tsx). Both Namkhan and Donna now render the same tree;
// per-property HoD voice + scoped subPages handled inside the body via
// getDeptCfg + rewriteSubPagesForProperty.
//
// 2026-05-22: forward searchParams so BookingActivity (task #82) can read
// its ?activityDays= filter from the URL.

import { notFound } from 'next/navigation';
import RevenueHoDBody from '@/app/revenue/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyRevenueHoDPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return <RevenueHoDBody propertyId={propertyId} searchParams={searchParams} />;
}
