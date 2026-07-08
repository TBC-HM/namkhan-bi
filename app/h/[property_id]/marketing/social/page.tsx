// app/h/[property_id]/marketing/social/page.tsx
// PBS 2026-07-08 — Donna marketing/social delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingSocial({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Social"
      namkhanPath="/marketing/social"
      hint="Will surface Donna social accounts + engagement analytics once social integrations get Donna tokens."
    />
  );
}
