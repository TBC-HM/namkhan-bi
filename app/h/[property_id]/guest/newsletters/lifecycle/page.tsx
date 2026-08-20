// app/h/[property_id]/guest/newsletters/lifecycle/page.tsx
// PBS 2026-08-20 · Donna tenant stub for newsletter lifecycle view.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaNewslettersLifecycle({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Guest"
      routeLabel="Newsletters · Lifecycle"
      namkhanPath="/guest/newsletters/lifecycle"
      hint="Lifecycle sequence viewer — activates for Donna once cron 122 fires against tenant recipients."
    />
  );
}
