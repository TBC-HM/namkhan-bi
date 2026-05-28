// app/holding/legal-lao/page.tsx
// PBS 2026-05-28: John — Lao legal & institutional-intelligence counsel, holding scope, reports to Felix.

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingLegalLao() {
  return <DeptEntry cfg={DEPT_CFG.holding_john} />;
}
