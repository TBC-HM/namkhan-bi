// app/finance/suppliers/page.tsx
// Finance · Suppliers — thin wrapper around the shared SuppliersView.
// Threads FINANCE_SUBPAGES + linkBase so row clicks route to
// /finance/suppliers/[name] rather than jumping to /operations.
// PBS 2026-06-09 #194 — Suppliers moved from Operations to Finance arm.

import SuppliersView from '@/app/operations/suppliers/_components/SuppliersView';
import { FINANCE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function FinanceSuppliersPage() {
  return (
    <SuppliersView
      subPages={FINANCE_SUBPAGES}
      activeHrefSuffix="/finance/suppliers"
      surfaceLabel="Finance"
      linkBase="/finance/suppliers"
    />
  );
}
