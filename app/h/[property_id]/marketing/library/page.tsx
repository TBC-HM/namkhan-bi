// app/h/[property_id]/marketing/library/page.tsx
// PBS 2026-07-08 — Donna marketing/library delegate. Renders same DashboardPage
// chrome as Namkhan (structure not data) via shared DeptSubpageStub.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingLibrary({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Library"
      namkhanPath="/marketing/library"
      hint="Will surface Donna asset library, docs, brand kits per property_id once /marketing/gallery + docs feeds are Donna-scoped."
    />
  );
}
