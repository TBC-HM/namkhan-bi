// app/h/[property_id]/finance/overview/page.tsx
// PBS 2026-09-05: replaced DeptSubpageStub with the live FinanceOverviewPage
// delegate, passing propertyId so data is scoped to the correct tenant.
import { notFound } from 'next/navigation';
import FinanceOverviewPage from '@/app/finance/overview/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HFinanceOverview({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) notFound();
  return <FinanceOverviewPage propertyId={propertyId} />;
}
