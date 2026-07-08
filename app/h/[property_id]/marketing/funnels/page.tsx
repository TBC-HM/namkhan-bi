// app/h/[property_id]/marketing/funnels/page.tsx
// PBS 2026-07-08 — Donna marketing/funnels delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingFunnels({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Funnels"
      namkhanPath="/marketing/funnels"
      hint="Will surface Donna growth funnels (channel · CAC · conversion) once acquisition analytics are Donna-scoped."
    />
  );
}
