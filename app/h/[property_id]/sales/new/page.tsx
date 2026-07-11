// app/h/[property_id]/sales/new/page.tsx
// PBS 2026-07-11 pm — Property-scoped delegate for Sales · Create New.
// Async delegate: awaits params, imports flat page, forwards propertyId.

import SalesNewPage from '@/app/sales/new/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DelegateSalesNew({ params }: { params: Promise<{ property_id: string }> }) {
  const { property_id } = await params;
  return <SalesNewPage propertyId={Number(property_id)} />;
}
