// app/finance/archive/page.tsx — Namkhan default (Administration · Archive)
import ArchiveOverviewPage from './_components/ArchiveOverviewPage';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { FINANCE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FinanceArchivePage() {
  return (
    <ArchiveOverviewPage
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
      subPagesOverride={FINANCE_SUBPAGES}
    />
  );
}
