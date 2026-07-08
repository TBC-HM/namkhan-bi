// app/h/[property_id]/guest/behaviour/page.tsx
// PBS 2026-07-08 — Donna guest/behaviour delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaGuestBehaviour({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Contacts"
      routeLabel="Behaviour"
      namkhanPath="/guest/behaviour"
      hint="Will surface Donna guest behaviour · spend patterns once ancillary attribution is Donna-scoped."
    />
  );
}
