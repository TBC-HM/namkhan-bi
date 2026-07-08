// app/h/[property_id]/sales/pipeline/page.tsx
// PBS 2026-07-08 — Donna sales/pipeline delegate. Namkhan /sales/pipeline
// redirects to /sales/leads?view=pipeline; Donna renders the delegate stub.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSalesPipeline({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel="Pipeline"
      namkhanPath="/sales/leads?view=pipeline"
      hint="Will surface Donna B2B pipeline once sales_inquiries + leads tables get Donna scoping."
    />
  );
}
