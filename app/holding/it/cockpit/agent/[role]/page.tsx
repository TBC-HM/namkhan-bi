// LEGACY SURFACE RETIRED — it-area-reorg-v1 final slice (2026-08-01).
// Agent debug view is it2-native under Fleet → Team.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function LegacyRedirect({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  redirect(`/holding/it2/fleet/team/agent/${role}`);
}
