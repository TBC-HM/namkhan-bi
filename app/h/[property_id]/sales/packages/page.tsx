// app/h/[property_id]/sales/packages/page.tsx
// PBS 2026-07-08 — Donna sales/packages delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSalesPackages({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel="Packages"
      namkhanPath="/sales/packages"
      hint="Will surface Donna sales packages once packages tables get Donna scoping."
    />
  );
}
