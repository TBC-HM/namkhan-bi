// LEGACY SURFACE RETIRED — it-area-reorg-v1 final slice (2026-08-01).
// The old IT Cockpit home is superseded by the IT2 Action Center.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function LegacyRedirect() { redirect('/holding/it2'); }
