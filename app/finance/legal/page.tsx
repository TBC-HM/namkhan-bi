// app/finance/legal/page.tsx — Namkhan default (Finance · Legal · CLO view)
import LegalCLOPage from './_components/LegalCLOPage';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { FINANCE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FinanceLegalPage() {
  return (
    <LegalCLOPage
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
      subPagesOverride={FINANCE_SUBPAGES}
    />
  );
}
