// app/h/[property_id]/marketing/docs/page.tsx
// PBS 2026-09-15 — the marketing asset library, property-scoped.
// Shelved by WHAT A THING IS, because nobody remembers that the fact sheet is called
// "Whats Our Story-reviewed.docx". Shelves, rows, preview/download links and dismiss state all come
// from /api/marketing/library, which reads fn_marketing_shelves / fn_marketing_assets.
// No counting SQL in this file — that is the point.
//
// Owner-driven corrections, 2026-09-15:
//   · selection is by document TYPE, not folder — a lease filed under Media/Pictures is still a lease
//     (100 financial/legal/compliance documents had leaked in through folder matching)
//   · duplicates collapse on normalised name + size, including the drive's -8e4f19ba hash suffixes.
//     Size alone would be wrong: two different SLH logos are both exactly 38,881 bytes
//   · shelves added from the original import tree: Scripts & video production (the AI Video Project
//     "Scipts" folder — the typo is in the drive), Farm panels, Travelife signage, Factsheets, Retreats
//   · six press releases misfiled as lease agreements are back on Press & media kit
//   · every row now has preview, download and dismiss
// Shrink waiver #9: the shelf rendering moved into LibraryClient.tsx so dismiss updates without a reload.
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import LibraryClient from './LibraryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

export default async function MarketingDocsLibrary({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const label = LABEL[propertyId] ?? 'Property';

  return (
    <DashboardPage
      title="Marketing · Docs"
      subtitle={`${label} asset library — what you reach for, not what the file is called. Dismiss removes a document from this list only; it stays in the document register and stays answerable by the brain.`}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Library"
          subtitle="Preview, download or dismiss any row. Shelves are ordered by how often you open them."
          density="compact"
        >
          <LibraryClient propertyId={propertyId} />
        </Container>
      </div>
    </DashboardPage>
  );
}
