// LEGACY SURFACE RETIRED — it-area-reorg-v1 final slice (2026-08-01).
// Module table + doc-release ledger + cut form live ONLY at Modules → Status (one fact = one surface).
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function LegacyRedirect() { redirect('/holding/it2/modules/status'); }
