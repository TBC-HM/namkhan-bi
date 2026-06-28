// app/operations/suppliers/[supplier]/page.tsx
// Operations · Suppliers · detail — thin wrapper around SupplierDetailView.

import SupplierDetailView from './_components/SupplierDetailView';
import { OPERATIONS_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props { params: { supplier: string } }

export default async function SupplierDetailPage({ params }: Props) {
  return (
    <SupplierDetailView
      supplierName={decodeURIComponent(params.supplier)}
      subPages={OPERATIONS_SUBPAGES}
      activeHrefSuffix="/operations/suppliers"
      surfaceLabel="Operations"
      registerHref="/operations/suppliers"
    />
  );
}
