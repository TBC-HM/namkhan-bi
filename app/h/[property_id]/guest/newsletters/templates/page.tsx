// app/h/[property_id]/guest/newsletters/templates/page.tsx
// PBS 2026-08-20 · Donna tenant stub for newsletter templates.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaNewslettersTemplates({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Guest"
      routeLabel="Newsletters · Templates"
      namkhanPath="/guest/newsletters/templates"
      hint="Template library — Donna templates can be added once brand_kit is seeded."
    />
  );
}
