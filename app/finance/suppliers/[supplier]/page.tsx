// app/finance/suppliers/[supplier]/page.tsx
// Finance · Suppliers · detail — thin wrapper around the shared
// SupplierDetailView, threaded with FINANCE_SUBPAGES so the chrome stays on
// the Finance surface when the user arrived from /finance/suppliers.

import SupplierDetailView from '@/app/operations/suppliers/[supplier]/_components/SupplierDetailView';
import { FINANCE_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props { params: { supplier: string } }

export default async function FinanceSupplierDetailPage({ params }: Props) {
  return (
    <SupplierDetailView
      supplierName={decodeURIComponent(params.supplier)}
      subPages={FINANCE_SUBPAGES}
      activeHrefSuffix="/finance/suppliers"
      surfaceLabel="Finance"
      registerHref="/finance/suppliers"
    />
  );
}
