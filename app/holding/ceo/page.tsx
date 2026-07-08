// app/holding/ceo/page.tsx
// PBS 2026-07-08: CEO surface promoted to a first-class holding dept.
import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingCeoPage() {
  return <DeptEntry cfg={DEPT_CFG.holding_ceo} />;
}
