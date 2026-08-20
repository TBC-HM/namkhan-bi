// app/h/[property_id]/sales/leads/scraping/page.tsx
// PBS 2026-08-20 · Donna tenant stub (retry after 409 branch race).
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyIdSalesLeadsScraping({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel={`Leads · Scraping`}
      namkhanPath={`/sales/leads/scraping`}
      hint="Lead scraping jobs — Donna operators can enqueue their own campaigns once scoping is enabled."
    />
  );
}
