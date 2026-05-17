// app/h/[property_id]/finance/hr/recruitment/page.tsx — property-scoped Recruitment under HR/Finance
import { notFound } from 'next/navigation';
import RecruitmentTabContent from '@/app/operations/staff/_components/RecruitmentTabContent';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

export default async function PropertyFinanceHrRecruitmentPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();
  return (
    <RecruitmentTabContent
      propertyId={propertyId}
      propertyLabel={KNOWN_LABEL[propertyId]}
      subPagesOverride={financeSubPagesForProperty(propertyId)}
    />
  );
}
