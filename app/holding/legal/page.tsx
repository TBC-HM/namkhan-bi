// app/holding/legal/page.tsx
// PBS 2026-05-14: Holding · Legal landing — Carla's surface.
// Canonical DeptEntry layout (same boxes as every HoD page).
// The holding top-strip lights "Legal" while on this route.

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingLegal() {
  return <DeptEntry cfg={DEPT_CFG.holding_legal} />;
}
