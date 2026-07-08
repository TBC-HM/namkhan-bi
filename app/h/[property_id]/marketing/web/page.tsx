// app/h/[property_id]/marketing/web/page.tsx
// PBS 2026-07-08 — Donna marketing/web delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingWeb({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Web"
      namkhanPath="/marketing/web"
      hint="Will surface Donna website analytics once GA4 / Search Console are Donna-scoped."
    />
  );
}
