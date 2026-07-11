// app/h/[property_id]/sales/pipeline/page.tsx
// PBS 2026-07-11 pm (dir 1) — Donna Sales · Pipeline delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSalesPipeline({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel="Pipeline"
      namkhanPath="/sales/pipeline"
      hint="Donna Sales pipeline goes live once Faro roster + Panama corp scrapers ingest leads."
    />
  );
}
