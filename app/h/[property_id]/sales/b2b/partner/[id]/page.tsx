// app/h/[property_id]/sales/b2b/partner/[id]/page.tsx
// PBS 2026-08-20 · Donna tenant stub (retry after 409 branch race).
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyIdSalesB2bPartnerId({ params }: { params: { property_id: string; id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel={`B2B Partner · ${params.id}`}
      namkhanPath={`/sales/b2b/partner/${params.id}`}
      hint="B2B partner detail — activates for Donna once DMC contract seeding completes."
    />
  );
}
