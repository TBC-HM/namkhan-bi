// app/h/[property_id]/sales/dashboard/page.tsx
// PBS 2026-08-20 · Donna tenant stub (retry after 409 branch race).
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyIdSalesDashboard({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel={`Dashboard`}
      namkhanPath={`/sales/dashboard`}
      hint="Sales dashboard — sequences after cockpit rollout."
    />
  );
}
