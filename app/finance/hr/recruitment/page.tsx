// app/finance/hr/recruitment/page.tsx — Namkhan default (Recruitment under HR/Finance)
import RecruitmentTabContent from '@/app/operations/staff/_components/RecruitmentTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { FINANCE_SUBPAGES } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FinanceHrRecruitmentPage() {
  return (
    <RecruitmentTabContent
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
      subPagesOverride={FINANCE_SUBPAGES}
    />
  );
}
