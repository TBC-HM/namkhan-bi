// app/cockpit-v2/page.tsx
// /cockpit-v2 -> /cockpit-v2/team (Team is the default tab).

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function CockpitV2Index() {
  redirect('/cockpit-v2/team');
}
