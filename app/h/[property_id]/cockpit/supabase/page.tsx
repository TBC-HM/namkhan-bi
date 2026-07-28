// app/h/[property_id]/cockpit/supabase/page.tsx
// This page has moved to /holding/supabase (holding-level route).
// Permanently redirect any visits to the old property-scoped URL.

import { permanentRedirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SupabaseInventoryPage(): never {
  permanentRedirect('/holding/supabase');
}
