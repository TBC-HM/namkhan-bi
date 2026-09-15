// app/h/[property_id]/sales/docs/page.tsx
// PBS 2026-09-15 — the sales document library. Same design and principles as Marketing · Docs:
// shelves are DERIVED in SQL (fn_sales_shelf), the page counts nothing, archived rows are not
// listed, duplicates collapse on normalised name + size, and every row has preview / download /
// dismiss.
//
// The backfill that matters: sales material was never reachable by doc_type. It sits under
// legal 660, partner 484, financial 415, vendor_doc, other and compliance. fn_sales_in_library
// admits documents by what they ARE — the NK SALES folder tree plus contract/booking/quotation
// names — which brings 1,672 documents into one surface. Menus filed under NK SALES/Menus are
// deliberately excluded: Marketing already shelves those, and one document should not be listed
// by two departments.
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { SALES_SUBPAGES } from '@/app/sales/_subpages';
import DocLibraryClient from '@/components/docs/DocLibraryClient';

// DashboardPage.smartTabs derives `active` from the pathname — key/label/href is all it needs.
const SALES_TABS: DashboardTab[] = SALES_SUBPAGES.map((s) => ({
  key: s.href, label: s.label, href: s.href,
}));

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

export default async function SalesDocsLibrary({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const label = LABEL[propertyId] ?? 'Property';

  return (
    <DashboardPage
      tabs={SALES_TABS}
      title="Sales · Docs"
      subtitle={`${label} sales library — agency contracts, group bookings, proposals and pick-up reports in one place. Dismiss removes a document from this list only; it stays in the document register and stays answerable by the brain.`}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Library"
          subtitle="Filter by shelf, year or file type. Every column sorts; archived documents are counted but not listed."
          density="compact"
        >
          <DocLibraryClient propertyId={propertyId} apiBase="/api/sales/library" />
        </Container>
      </div>
    </DashboardPage>
  );
}
