// app/h/[property_id]/guest/newsletters/templates/link-catalog/page.tsx
// PBS 2026-08-20 · Donna tenant stub (retry after 409 branch race).
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyIdGuestNewslettersTemplatesLinkCatalog({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Guest"
      routeLabel={`Newsletter Link Catalog`}
      namkhanPath={`/guest/newsletters/templates/link-catalog`}
      hint="Pinned URL catalog — Donna links seed via marketing.internal_link_catalog inserts scoped to tenant."
    />
  );
}
