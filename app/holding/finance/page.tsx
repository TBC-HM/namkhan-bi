// app/holding/finance/page.tsx
// PBS 2026-07-08: Holding-level Finance HoD landing (Beyond Circle).
// Cross-entity invoicing to DMCs / partners / third parties.
import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingFinancePage() {
  return <DeptEntry cfg={DEPT_CFG.holding_finance} />;
}
