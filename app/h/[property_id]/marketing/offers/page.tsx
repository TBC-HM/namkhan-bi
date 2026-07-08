// app/h/[property_id]/marketing/offers/page.tsx
// PBS 2026-07-08 — Donna marketing/offers delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingOffers({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Offers"
      namkhanPath="/marketing/offers"
      hint="Will surface Donna packages · promotions · Wholesale offers once offers tables get Donna scoping."
    />
  );
}
