// app/h/[property_id]/guest/prospects/page.tsx
// PBS 2026-07-08 — Donna guest/prospects delegate. Same sub-strip target that
// /marketing/acquisition subgroup uses (see lib/nav-subgroups.ts).
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaGuestProspects({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Contacts"
      routeLabel="Prospects"
      namkhanPath="/guest/prospects"
      hint="Will surface Donna prospects once prospect tables get Donna scoping."
    />
  );
}
