// app/h/[property_id]/guest/newsletters/[campaign_id]/page.tsx
// PBS 2026-08-20 · Donna tenant stub (retry after 409 branch race).
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyIdGuestNewslettersCampaignId({ params }: { params: { property_id: string; campaign_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Guest"
      routeLabel={`Newsletter Campaign · ${params.campaign_id}`}
      namkhanPath={`/guest/newsletters/${params.campaign_id}`}
      hint="Campaign editor — Donna-scoped campaigns appear once guest.campaigns.property_id filter is enabled upstream."
    />
  );
}
