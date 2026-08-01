// LEGACY SURFACE RETIRED — it-area-reorg-v1 final slice (2026-08-01).
// Module doc preview is it2-native under Modules → Module Docs.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function LegacyRedirect({ params }: { params: Promise<{ docType: string }> }) {
  const { docType } = await params;
  redirect(`/holding/it2/modules/specs/${docType}`);
}
