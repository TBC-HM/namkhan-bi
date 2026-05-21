// app/h/[property_id]/revenue/page.tsx
// 2026-05-21: delegate to the shared primitives-based Revenue HoD page
// (app/revenue/page.tsx). Both Namkhan and Donna now render the same tree;
// per-property HoD voice + scoped subPages handled inside the body via
// getDeptCfg + rewriteSubPagesForProperty.

import { notFound } from 'next/navigation';
import RevenueHoDBody from '@/app/revenue/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyRevenueHoDPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return <RevenueHoDBody propertyId={propertyId} />;
}
