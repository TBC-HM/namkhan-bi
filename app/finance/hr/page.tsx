// app/finance/hr/page.tsx
//
// PBS 2026-05-15: HR menu entry was originally pointed at /operations/staff,
// which dropped the user into the Operations sub-menu strip. Per PBS the URL
// itself must live in the finance tree so the Finance sub-pages stay visible.
//
// This page re-uses the canonical StaffPageContent component (the real
// implementation lives in app/operations/staff/_components/) but renders
// it under the /finance/hr URL so the Finance top strip is preserved.

import StaffPageContent from '@/app/operations/staff/_components/StaffPageContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { FINANCE_SUBPAGES } from '../_subpages';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function FinanceHrPage({ searchParams }: Props) {
  return (
    <StaffPageContent
      propertyId={NAMKHAN_PROPERTY_ID}
      searchParams={searchParams}
      subPagesOverride={FINANCE_SUBPAGES}
    />
  );
}
