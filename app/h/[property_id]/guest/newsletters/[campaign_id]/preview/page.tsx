// app/h/[property_id]/guest/newsletters/[campaign_id]/preview/page.tsx
// PBS 2026-08-20 · Donna tenant stub for newsletter campaign preview.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaNewsletterCampaignPreview({ params }: { params: { property_id: string; campaign_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Guest"
      routeLabel={`Newsletter Preview · ${params.campaign_id}`}
      namkhanPath={`/guest/newsletters/${params.campaign_id}/preview`}
      hint="Campaign preview + send test — wires for Donna once tenant campaigns are addressable."
    />
  );
}
