// app/h/[property_id]/marketing/audience/page.tsx
// PBS 2026-08-20 · Donna audience stub (singular route to match Namkhan /marketing/audience).
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingAudience({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Audience"
      namkhanPath="/marketing/audience"
      hint="Audience groups + routing — Donna audiences activate once guest.groups seed contains tenant tags (guests-donna-*)."
    />
  );
}
