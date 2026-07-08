// app/h/[property_id]/operations/overview/page.tsx
// PBS 2026-07-08 — Donna operations/overview delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaOperationsOverview({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Operations"
      routeLabel="Overview"
      namkhanPath="/operations/overview"
      hint="Will surface Donna operations snapshot (in-house · arrivals · capture) once v_overview_live and v_*_snapshot views accept Donna property_id."
    />
  );
}
