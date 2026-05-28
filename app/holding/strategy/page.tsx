// app/holding/strategy/page.tsx
// PBS 2026-05-28: Fox — Group strategy & structure advisor, holding scope, reports to Felix.

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingStrategy() {
  return <DeptEntry cfg={DEPT_CFG.holding_strategy} />;
}
