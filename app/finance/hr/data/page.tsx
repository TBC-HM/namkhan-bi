// app/finance/hr/data/page.tsx — Namkhan default (Data under HR/Finance)
import DataTabContent from '@/app/operations/staff/_components/DataTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { FINANCE_SUBPAGES } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FinanceHrDataPage() {
  return (
    <DataTabContent
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
      subPagesOverride={FINANCE_SUBPAGES}
    />
  );
}
