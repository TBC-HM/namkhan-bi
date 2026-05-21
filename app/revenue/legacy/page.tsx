// app/revenue/legacy/page.tsx
// Legacy Revenue HoD (DeptEntry, full chat + project + reports + bugs).
// Kept reachable so the chat experience continues to work while the
// canonical /revenue is now the primitives-based dashboard.
import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';

export default function RevenueLegacyPage() {
  return <DeptEntry cfg={DEPT_CFG.revenue} />;
}
