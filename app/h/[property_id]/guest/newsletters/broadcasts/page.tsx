// app/h/[property_id]/guest/newsletters/broadcasts/page.tsx
// PBS 2026-08-20 · Donna tenant stub for newsletter broadcasts.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaNewslettersBroadcasts({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Guest"
      routeLabel="Newsletters · Broadcasts"
      namkhanPath="/guest/newsletters/broadcasts"
      hint="Ad-hoc broadcast composer — wires to Donna guest.campaigns once tenant scope is added upstream."
    />
  );
}
