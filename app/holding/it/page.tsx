// app/holding/it/page.tsx
// PBS 2026-05-14: Holding · IT landing — Kit's surface.
// Canonical DeptEntry layout (same boxes as every HoD page).

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingIT() {
  return <DeptEntry cfg={DEPT_CFG.holding_it} />;
}
