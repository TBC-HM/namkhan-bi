// app/operations/suppliers/[supplier]/page.tsx
// Operations · Suppliers · detail — renders in Operations chrome.
// 2026-08-01: restored from redirect stub. Previously redirected to
// /finance/suppliers/[name] (PR #194), but operations should stay in operations.
// Finance detail page remains at /finance/suppliers/[name] for finance team.
import SupplierDetailView from './_components/SupplierDetailView';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { supplier: string } }

export default async function OperationsSupplierDetailPage({ params }: Props) {
  const cfg = DEPT_CFG.operations;
  return (
    <SupplierDetailView
      supplierName={decodeURIComponent(params.supplier)}
      subPages={cfg.subPages}
      activeHrefSuffix='/operations/suppliers'
      surfaceLabel='Operations'
      registerHref='/operations/suppliers'
    />
  );
}
