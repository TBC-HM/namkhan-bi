// app/holding/it/cockpit/_lib/supabase-cockpit.ts
// Server-side Supabase client scoped to the cockpit + documentation schemas.
// SERVICE ROLE — never imported from a 'use client' file. Used by the cockpit-v2
// segment pages (server components) to read live agent / skill / memory state.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://build-placeholder.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'build-placeholder-anon';
const key = serviceKey ?? anonKey;

// Default schema is `cockpit` — most queries here read cap_* / kn_* / id_agents.
// Documentation reads explicitly call `.schema('documentation')`.
export const sbCockpit = createClient(url, key, {
  auth: { persistSession: false },
  db: { schema: 'cockpit' },
});

export const sbDocs = createClient(url, key, {
  auth: { persistSession: false },
  db: { schema: 'documentation' },
});
