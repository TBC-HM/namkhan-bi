// app/finance/suppliers/page.tsx
// Finance · Suppliers — vendor register in Finance chrome.
// Sub-strip: Vendor Register (here) | GL Mapping (/finance/supplier-mapping)
// 2026-08-01: sub-strip placed correctly INSIDE page content as first child.
import SuppliersView from '@/app/operations/suppliers/_components/SuppliersView';
import { FINANCE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function FinanceSuppliersPage() {
  return (
    <SuppliersView
      subPages={FINANCE_SUBPAGES}
      activeHrefSuffix='/finance/suppliers'
      surfaceLabel='Finance'
      linkBase='/finance/suppliers'
    />
  );
}
