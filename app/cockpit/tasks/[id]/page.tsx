// LEGACY SURFACE RETIRED — PBS 2026-07-30. Preserves the ticket id.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function LegacyRedirect({ params }: { params: { id: string } }) {
  redirect(`/holding/it/cockpit/tasks/${params.id}`);
}
