// app/h/[property_id]/marketing/prospects/page.tsx
// PBS 2026-07-08 — Donna marketing/prospects delegate. Reminder: /marketing/prospects
// is the email nurture cockpit (not to be confused with /marketing/funnels which is
// growth). See reference_2026_07_05_handover.md.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingProspects({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Prospects"
      namkhanPath="/marketing/prospects"
      hint="Will surface Donna email prospect sequences once prospects tables get Donna scoping."
    />
  );
}
