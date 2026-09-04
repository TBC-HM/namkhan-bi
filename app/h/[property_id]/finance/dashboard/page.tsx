// app/h/[property_id]/finance/dashboard/page.tsx
// Delegates to the canonical finance EngineDashboard, passing property_id
// so the discount/adjustments panels are scoped to this property.
import { notFound } from 'next/navigation';
import FinancePage from '@/app/finance/dashboard/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FinanceDashboardPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return <FinancePage searchParams={{ property_id: String(propertyId) }} />;
}
