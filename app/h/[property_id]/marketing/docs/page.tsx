// app/h/[property_id]/marketing/docs/page.tsx
// PBS 2026-07-08 — Donna marketing/docs delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingDocs({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Docs"
      namkhanPath="/marketing/docs"
      hint="Will surface Donna marketing docs library once Donna-scoped documentation tagging lands."
    />
  );
}
