// lib/supabaseAdmin.ts
// Server-only Supabase client using the service-role key.
// NEVER import this from a client component or expose the key to the browser.
// Used for: signed-URL minting, Edge Function invocation, and any write that
// must bypass RLS (e.g., media ingest pipeline).

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!serviceKey) {
  // Don't crash at import time; fail at first use so the rest of the app keeps loading.
  // eslint-disable-next-line no-console
  console.warn('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY not set — server media routes will 500');
}

export const supabaseAdmin = createClient(url, serviceKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'public' },
});

export const PROPERTY_ID = Number(process.env.NEXT_PUBLIC_PROPERTY_ID || 260955);
