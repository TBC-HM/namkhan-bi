// app/front-office/page.tsx
// Pillar landing — redirects to the only wired sub-tab (Arrivals).
// Other 6 sub-tabs (In-house, Departures, Walk-ins, Handover, VIP & Cases, Roster)
// ship as `coming: true` placeholders in subnavConfig.

import { redirect } from 'next/navigation';

export default function FrontOfficePage() {
  redirect('/front-office/arrivals');
}
