// app/h/[property_id]/sales/new/page.tsx
// PBS 2026-07-11 pm (dir 1) — Donna Sales · Create New delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSalesCreateNew({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel="Create New"
      namkhanPath="/sales/new"
      hint="Donna Sales Create-New activates once Faro roster + inbound sources are wired."
    />
  );
}
