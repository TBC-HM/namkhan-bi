// lib/supabase.ts
// SERVER-ONLY. The single supabase client used by every server page,
// server action, and route handler. Uses the service-role key — RLS is
// the wrong access model for this single-tenant, password-gated dashboard
// where every authorised viewer needs to see every row anyway. (Mass
// page-empty bug 2026-05-09: anon RLS was silently returning [] from
// staff_register / transactions / reservations / dmc_contracts and many
// other tables; switching the shared client to service-role fixes every
// affected page in one shot.)
//
// Safety: NO client component imports this module — verified 2026-05-09
// via grep across app/ + components/ + lib/ for 'use client'. Vercel will
// not bundle SUPABASE_SERVICE_ROLE_KEY into the browser since this file is
// only reached from server contexts.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Lazy proxy so import-time failures don't block local builds without env.
let cached: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (cached) return cached;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  // Prefer service role; fall back to anon (kept so non-prod environments
  // that don't ship the secret still get a client, even if reads return []).
  const key = serviceKey ?? anonKey;
  if (!key) throw new Error('No SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY set');
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop, receiver) {
    return Reflect.get(client(), prop, receiver);
  },
});

export const PROPERTY_ID = Number(process.env.NEXT_PUBLIC_PROPERTY_ID || 260955);
