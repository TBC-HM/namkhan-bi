// app/holding/page.tsx
// PBS 2026-05-14 (v2): Beyond Circle / Holding landing — Felix's surface.
//
// Now renders the canonical DeptEntry component (same boxes as every HoD
// and the Nova/Orion CEO entry pages): My Attention · Reports · Tasks ·
// Bugs · Messages — populated from HOLDING_CFG.
//
// The cfg's customExtra='holding' slot injects the BC peach property-tile
// grid and Cockpit CTA between the chat row and the boxes. hideWeather
// keeps the top-right pill row clean (temp/AQI are property-scoped).

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingHome() {
  return <DeptEntry cfg={DEPT_CFG.holding} />;
}
