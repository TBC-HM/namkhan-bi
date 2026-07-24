// app/holding/it/brain/page.tsx
// PBS 2026-07-24: the Brain is property-level, not holding-level — console
// moved to /h/[property_id]/settings/brain (Settings strip · Brain tab).
// This legacy path 307-redirects to the Namkhan brain. BrainClient.tsx stays
// in this folder as the shared component (imported by the settings page).

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function BrainPage() {
  redirect('/h/260955/settings/brain');
}
