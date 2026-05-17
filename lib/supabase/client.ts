// lib/supabase/client.ts
//
// PBS 2026-05-17: browser-safe Supabase client for 'use client' components.
// Uses ANON key (not service-role) so it's safe in the browser bundle.
// Server components MUST keep importing from '@/lib/supabase' (service-role).
//
// Created to unstick prod build cf180866 — FinanceShell + reports/page.tsx
// expected this module to exist; runner_v3 omitted it from PR #309.

'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
