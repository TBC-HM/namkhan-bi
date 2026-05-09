// lib/supabase.ts
// SERVER-ONLY shared supabase client. Service-role key — RLS is the wrong
// model for this single-tenant, password-gated dashboard. Mass page-empty
// bug 2026-05-09: anon RLS was silently returning [] from staff_register,
// transactions, reservations, dmc_contracts, and many other tables.
// Switching the shared client to service-role fixes every affected page.
//
// Safety: NO 'use client' file imports this module — verified 2026-05-09.
// SUPABASE_SERVICE_ROLE_KEY does not leak to the browser bundle.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-placeholder-anon");

// Prefer service role; fall back to anon (kept so non-prod environments
// without the secret still get a working client, even if reads return []).
const key = serviceKey ?? anonKey;

export const supabase: SupabaseClient = createClient(url, key, {
  auth: { persistSession: false },
});

export const PROPERTY_ID = Number(process.env.NEXT_PUBLIC_PROPERTY_ID || 260955);
