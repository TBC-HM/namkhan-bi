// app/h/[property_id]/sales/cockpit/page.tsx
// PBS 2026-08-20 · Donna Sales cockpit stub.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSalesCockpit({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel="Cockpit"
      namkhanPath="/sales/cockpit"
      hint="Sales cockpit — lands per-Donna tiles once sales.* views expose property_id."
    />
  );
}
