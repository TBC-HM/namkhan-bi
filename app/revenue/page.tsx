// app/revenue/page.tsx
// Wrapper — actual entry layout lives in components/dept-entry/DeptEntry.tsx,
// parameterized by lib/dept-cfg/index.ts (DEPT_CFG.revenue).
import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export default function RevenuePage() {
  return <DeptEntry cfg={DEPT_CFG.revenue} />;
}
