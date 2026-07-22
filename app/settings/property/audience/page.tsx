// app/settings/property/audience/page.tsx
// PBS 2026-07-22 pm · LEGACY REDIRECT.
//
// This tree pre-dates the /h/[property_id]/... canonical settings surface.
// PBS accidentally edited goals here (going into the same DB but landing on
// a non-canonical view) — this page now 307s to the canonical property-scoped
// Newsletter tab. Do NOT delete: the _components/ dir is still imported by
// the canonical page under /h/[pid]/... and any link-out that still points
// here should just redirect.

import { redirect } from 'next/navigation';

export default function LegacyAudienceRedirect() {
  redirect('/h/260955/settings/property/audience');
}
