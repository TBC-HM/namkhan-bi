// app/holding/legal/lao/page.tsx
// PBS 2026-07-08: Legal · Lao moved from top-level (/holding/legal-lao)
// to a sub-nav inside /holding/legal. Same content — John's DeptEntry.
import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingLegalLaoPage() {
  return <DeptEntry cfg={DEPT_CFG.holding_john} />;
}
