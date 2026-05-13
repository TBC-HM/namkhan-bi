// app/h/[property_id]/operations/staff/page.tsx
// PBS 2026-05-13 — property-scoped staff page. Renders the SAME
// StaffPageContent component used at /operations/staff (Namkhan default),
// just with the propertyId from the URL.
//
// Donna (1000001) has no staff data today → page renders empty-state
// banner + zero KPIs. The moment Mews / HR data lands for Donna,
// the page populates without code change.

import StaffPageContent from '../../../../operations/staff/_components/StaffPageContent';
import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const PROPERTY_LABELS: Record<number, string> = {
  [NAMKHAN_PROPERTY_ID]: 'Namkhan',
  [DONNA_PROPERTY_ID]:   'Donna Portals',
};

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function StaffPageScoped({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) {
    // Bad URL — fall back to Namkhan rather than 500
    return (
      <StaffPageContent
        propertyId={NAMKHAN_PROPERTY_ID}
        propertyLabel={PROPERTY_LABELS[NAMKHAN_PROPERTY_ID]}
        searchParams={searchParams}
      />
    );
  }
  return (
    <StaffPageContent
      propertyId={propertyId}
      propertyLabel={PROPERTY_LABELS[propertyId] ?? `Property ${propertyId}`}
      searchParams={searchParams}
    />
  );
}
