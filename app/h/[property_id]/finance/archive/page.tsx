// app/h/[property_id]/finance/archive/page.tsx — property-scoped Administration · Archive
import { notFound } from 'next/navigation';
import ArchiveOverviewPage from '@/app/finance/archive/_components/ArchiveOverviewPage';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

export default function PropertyFinanceArchivePage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();
  return (
    <ArchiveOverviewPage
      propertyId={propertyId}
      propertyLabel={KNOWN_LABEL[propertyId]}
      subPagesOverride={financeSubPagesForProperty(propertyId)}
    />
  );
}
