// app/cockpit/schedule/page.tsx
// PBS 2026-05-09: /cockpit/schedule was 404. The Schedule tab lives inside
// /cockpit?tab=schedule — redirect there so direct URL access works.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function CockpitScheduleRedirect() {
  redirect('/cockpit?tab=schedule');
}
