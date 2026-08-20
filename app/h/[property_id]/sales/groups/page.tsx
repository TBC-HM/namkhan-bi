// app/h/[property_id]/sales/groups/page.tsx
// PBS 2026-08-20 · Donna Sales groups stub.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSalesGroups({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel="Groups"
      namkhanPath="/sales/groups"
      hint="Groups pipeline — Donna wiring once group inquiries are property-tagged."
    />
  );
}
