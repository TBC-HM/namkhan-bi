// app/holding/it/cockpit/notify/page.tsx
// Notify feed — V2 port of /cockpit/notify. Reads cockpit_pbs_notifications
// (view; the V1 page referenced v_pbs_notifications_feed which does not
// exist in the current Supabase project — cockpit_pbs_notifications has the
// same shape). Initial 80 rows server-rendered; client polls every 30s.
//
// Author: IT-team agent · 2026-05-13 · #58.

import { fetchNotifications } from '../_lib/data-port';
import { NotifyView } from './NotifyView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function CockpitV2NotifyPage() {
  const initial = await fetchNotifications(80);
  return <NotifyView initial={initial} />;
}
