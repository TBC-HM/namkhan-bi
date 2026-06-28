// app/operations/suppliers/[supplier]/page.tsx
// PBS 2026-06-09 #194: Suppliers moved Operations → Finance.
// PBS 2026-06-29: this legacy URL now permanently redirects to
// /finance/suppliers/[name] so the operations chrome never appears for
// supplier surfaces. The shared SupplierDetailView lives in this directory
// but is consumed only via the /finance/suppliers/[supplier] wrapper.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { supplier: string } }

export default function LegacyOperationsSupplierDetail({ params }: Props) {
  redirect(`/finance/suppliers/${params.supplier}`);
}
