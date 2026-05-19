// app/cockpit/supabase/page.tsx
// Legacy redirect for the pre-/h/ era. Brief acceptance #2:
// /cockpit/supabase → /h/260955/cockpit/supabase (Namkhan only).

import { redirect } from 'next/navigation';

const NAMKHAN_PROPERTY_ID = 260955;

export default function LegacyCockpitSupabaseRedirect() {
  redirect(`/h/${NAMKHAN_PROPERTY_ID}/cockpit/supabase`);
}
