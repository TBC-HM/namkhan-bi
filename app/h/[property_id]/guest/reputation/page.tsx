// app/h/[property_id]/guest/reputation/page.tsx
// PBS 2026-07-08 — Donna guest/reputation delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaGuestReputation({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Contacts"
      routeLabel="Reputation"
      namkhanPath="/guest/reputation"
      hint="Will surface Donna reviews · response rates once mkt_reviews are Donna-tagged."
    />
  );
}
