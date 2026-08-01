// app/finance/suppliers/page.tsx
// Finance · Suppliers — vendor register in Finance chrome.
// Sub-strip: Vendor Register | GL Mapping (→ /finance/supplier-mapping)
// PBS 2026-06-09 #194 — Suppliers moved from Operations to Finance arm.
// 2026-08-01 — sub-strip added; stays as finance-context view of same master data.
import SuppliersView from '@/app/operations/suppliers/_components/SuppliersView';
import FinSupplierSubTabs from './_components/FinSupplierSubTabs';
import { FINANCE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function FinanceSuppliersPage() {
  return (
    <>
      <FinSupplierSubTabs />
      <SuppliersView
        subPages={FINANCE_SUBPAGES}
        activeHrefSuffix='/finance/suppliers'
        surfaceLabel='Finance'
        linkBase='/finance/suppliers'
      />
    </>
  );
}
