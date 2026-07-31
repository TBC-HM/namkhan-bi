// LEGACY SURFACE MOVED — it-area-reorg-v1 consolidation pass (2026-07-31):
// implementation now lives under /holding/it2. This stub keeps the old URL
// alive (zero dead links) until PBS approves deleting the old IT tree.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function LegacyRedirect() { redirect('/holding/it2/system/activity'); }
