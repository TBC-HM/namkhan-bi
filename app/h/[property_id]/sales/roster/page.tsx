// app/h/[property_id]/sales/roster/page.tsx
// PBS 2026-08-20 · Donna tenant stub (retry after 409 branch race).
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyIdSalesRoster({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel={`Roster`}
      namkhanPath={`/sales/roster`}
      hint="Sales roster — Donna sellers can be onboarded via emp.employees + role assignment."
    />
  );
}
