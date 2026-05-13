// app/operations/staff/page.tsx
// PBS 2026-05-13 — thin wrapper for the legacy/Namkhan route.
// Real work lives in StaffPageContent so /h/[property_id]/operations/staff
// can render the SAME component with a different propertyId.

import StaffPageContent from './_components/StaffPageContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function StaffPage({ searchParams }: Props) {
  return (
    <StaffPageContent
      propertyId={NAMKHAN_PROPERTY_ID}
      searchParams={searchParams}
    />
  );
}
