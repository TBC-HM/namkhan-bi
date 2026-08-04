// app/h/[property_id]/sales/leads/page.tsx
// Tenant-scoped delegate for Sales · Leads.
// Was DeptSubpageStub (ADR-147 placeholder) — upgraded 2026-08-04 to
// match the proposals/pipeline delegate pattern (ADR-168).
// Passes propertyId so the root CRM filters to the correct tenant.

import SalesLeadsPage from '@/app/sales/leads/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PropertySalesLeads({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: { highlight?: string; stage?: string };
}) {
  const pid = Number(params.property_id);
  return <SalesLeadsPage propertyId={pid} searchParams={searchParams} />;
}
