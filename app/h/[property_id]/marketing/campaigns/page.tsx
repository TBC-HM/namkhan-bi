// app/h/[property_id]/marketing/campaigns/page.tsx
// PBS 2026-07-08 — Donna marketing/campaigns delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingCampaigns({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Campaigns"
      namkhanPath="/marketing/campaigns"
      hint="Will surface Donna email/paid campaigns once the campaigns table gets property_id scoping."
    />
  );
}
