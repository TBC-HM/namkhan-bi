// app/h/[property_id]/marketing/gallery/page.tsx
// PBS 2026-07-08 — Donna marketing/gallery delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingGallery({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Media"
      namkhanPath="/marketing/gallery"
      hint="Will surface Donna media gallery once media assets get Donna tenant tagging."
    />
  );
}
