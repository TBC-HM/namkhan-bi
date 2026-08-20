// app/h/[property_id]/sales/inquiries/[id]/page.tsx
// PBS 2026-08-20 · Donna inquiry detail stub.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaInquiryDetail({ params }: { params: { property_id: string; id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel={`Inquiry · ${params.id}`}
      namkhanPath={`/sales/inquiries/${params.id}`}
      hint="Inquiry detail — Donna inquiries land once ingestion is tenant-scoped."
    />
  );
}
