// app/h/[property_id]/guest/newsletters/page.tsx
// PBS 2026-07-08 — Donna guest/newsletters delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaGuestNewsletters({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Contacts"
      routeLabel="Newsletters"
      namkhanPath="/guest/newsletters"
      hint="Will surface Donna newsletter subscriber base once subscribers table is Donna-scoped."
    />
  );
}
