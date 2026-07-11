// app/h/[property_id]/sales/packages/page.tsx
// PBS 2026-07-11 pm — Property-scoped delegate for Sales · Packages.

import SalesPackagesPage from '@/app/sales/packages/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DelegateSalesPackages({ params }: { params: Promise<{ property_id: string }> }) {
  const { property_id } = await params;
  return <SalesPackagesPage propertyId={Number(property_id)} />;
}
