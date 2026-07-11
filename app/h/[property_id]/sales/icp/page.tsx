// app/h/[property_id]/sales/icp/page.tsx
// PBS 2026-07-11 pm — ADR-147. Donna ICP Segments delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSalesIcp({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel="ICP Segments"
      namkhanPath="/sales/icp"
      hint="Donna ICP model lands after Faro segments + Panama corp scrapers are wired."
    />
  );
}
