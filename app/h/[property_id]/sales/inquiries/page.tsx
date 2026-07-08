// app/h/[property_id]/sales/inquiries/page.tsx
// PBS 2026-07-08 — Donna sales/inquiries delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSalesInquiries({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel="Inquiries"
      namkhanPath="/sales/inquiries"
      hint="Will surface Donna inquiry inbox once sales_inquiries.property_id is Donna-scoped."
    />
  );
}
