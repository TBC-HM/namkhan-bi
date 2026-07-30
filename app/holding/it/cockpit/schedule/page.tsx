// LEGACY SURFACE MOVED — it-area-reorg-v1 consolidation pass (2026-07-30):
// Schedule is folded into IT2 Fleet → Tasks ("Tasks (+Schedule folded)").
// This stub keeps the old URL alive until PBS approves deleting the old IT tree.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function LegacyRedirect() { redirect('/holding/it2/fleet/tasks'); }
