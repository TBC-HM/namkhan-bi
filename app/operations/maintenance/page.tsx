// app/operations/maintenance/page.tsx
// PBS 2026-08-20 · fixes 404 on /operations/maintenance.
// Maintenance is property-native (lives only at /h/[property_id]/operations/maintenance/*).
// Dept-cfg sub-stripe tab points to /operations/maintenance, so this page
// redirects to Namkhan's property-scoped surface. rewriteSubPagesForProperty
// still swaps the property_id for Donna/other tenants.

import { redirect } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OperationsMaintenanceRedirect() {
  redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/maintenance`);
}
