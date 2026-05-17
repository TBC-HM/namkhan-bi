// app/h/[property_id]/finance/legal/page.tsx — property-scoped Finance · Legal · CLO view
import { notFound } from 'next/navigation';
import LegalCLOPage from '@/app/finance/legal/_components/LegalCLOPage';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

export default function PropertyFinanceLegalPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();
  return (
    <LegalCLOPage
      propertyId={propertyId}
      propertyLabel={KNOWN_LABEL[propertyId]}
      subPagesOverride={financeSubPagesForProperty(propertyId)}
    />
  );
}
