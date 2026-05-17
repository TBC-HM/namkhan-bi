// app/h/[property_id]/finance/hr/data/page.tsx — property-scoped Data under HR/Finance
import { notFound } from 'next/navigation';
import DataTabContent from '@/app/operations/staff/_components/DataTabContent';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

export default async function PropertyFinanceHrDataPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();
  return (
    <DataTabContent
      propertyId={propertyId}
      propertyLabel={KNOWN_LABEL[propertyId]}
      subPagesOverride={financeSubPagesForProperty(propertyId)}
    />
  );
}
