// app/h/[property_id]/finance/overview/page.tsx
// PBS 2026-07-08 — Donna finance/overview delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaFinanceOverview({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Finance"
      routeLabel="Overview"
      namkhanPath="/finance/overview"
      hint="Will surface Donna finance entry cards once dedicated overview data (P&L / Ledger / HR / Budget / Working capital / Reports) is fully Donna-scoped."
    />
  );
}
