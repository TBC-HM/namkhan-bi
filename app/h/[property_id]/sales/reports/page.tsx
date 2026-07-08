// app/h/[property_id]/sales/reports/page.tsx
// PBS 2026-07-08 — Donna sales/reports delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSalesReports({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel="Reports"
      namkhanPath="/sales/reports"
      hint="Will surface Donna printable sales reports once report presets are Donna-tagged."
    />
  );
}
