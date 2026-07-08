// app/h/[property_id]/marketing/digital/page.tsx
// PBS 2026-07-08 — Donna marketing/digital delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingDigital({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Digital"
      namkhanPath="/marketing/digital"
      hint="Will surface Donna web · SEO · paid channel performance once digital analytics are Donna-scoped."
    />
  );
}
