// app/h/[property_id]/sales/icp/page.tsx
// PBS 2026-07-11 pm — Property-scoped delegate for Sales · ICP Segments.

import IcpSegmentsPage from '@/app/sales/icp/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DelegateSalesIcp({ params }: { params: Promise<{ property_id: string }> }) {
  const { property_id } = await params;
  return <IcpSegmentsPage propertyId={Number(property_id)} />;
}
