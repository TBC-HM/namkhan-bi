// app/h/[property_id]/guest/directory/page.tsx
// PBS 2026-07-08 — Donna guest/directory delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaGuestDirectory({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Contacts"
      routeLabel="Directory"
      namkhanPath="/guest/directory"
      hint="Will surface Donna guest directory once guest.v_directory_full and mv_guest_profile are Donna-scoped."
    />
  );
}
