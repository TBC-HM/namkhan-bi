// lib/supabaseAdmin.ts
// Server-only Supabase client using the service-role key. NEVER import this
// from a "use client" component or expose it to the browser.
//
// Service role bypasses RLS — used by API routes that need to write to
// storage / restricted tables on behalf of the password-gated dashboard user.
//
// Required env var (set in Vercel → namkhan-bi → Settings → Environment Variables):
//   SUPABASE_SERVICE_ROLE_KEY  — service_role key from Supabase project API settings.
// If missing, getSupabaseAdmin() throws with a clear message.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set on this deployment. ' +
      'Add it in Vercel → namkhan-bi → Settings → Environment Variables. ' +
      'Get the value from Supabase → Project Settings → API → service_role secret.'
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
