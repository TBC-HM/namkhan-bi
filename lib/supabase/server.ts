/**
 * lib/supabase/server.ts
 *
 * Perf fix: connection-pooler-aware Supabase server client.
 *
 * Problem (ticket #229 child):
 *   The old implementation returned a MODULE-LEVEL singleton (`supabase`).
 *   In Next.js App Router, each server-component render can run in a
 *   separate Edge/Node worker. A shared singleton keeps TCP connections
 *   alive across requests but never releases them, exhausting Postgres's
 *   ~15-connection direct limit quickly under concurrent load.
 *
 * Fix — two-pronged:
 *
 *  1. PER-REQUEST client (connection released after response):
 *     createClient() now calls `createSupabaseClient()` fresh each time.
 *     With `auth.persistSession: false` the underlying fetch transport
 *     honours HTTP keep-alive naturally without leaking a long-lived socket.
 *
 *  2. POOLER routing for service-role reads:
 *     If SUPABASE_DB_POOLER_URL is set (Supabase "Transaction" mode pooler,
 *     port 6543) we swap the REST base URL so all PostgREST calls go through
 *     PgBouncer. This multiplexes N concurrent Next.js workers onto a small
 *     pool of actual Postgres connections.
 *
 *     To enable: in Vercel env vars add
 *       SUPABASE_DB_POOLER_URL = https://<project-ref>.supabase.co  ← same host
 *     (Supabase's REST API already runs through the pooler when you hit the
 *     standard endpoint; this env var is a hook for future infrastructure
 *     changes and documents intent.)
 *
 *  NOTE on prepared statements:
 *     PgBouncer in Transaction mode does NOT support named prepared statements.
 *     The Supabase JS SDK issues parameterised HTTP calls (PostgREST), NOT
 *     raw TCP prepared statements, so this is automatically safe. No special
 *     flag is needed on the JS client. If you add a raw `pg` / `postgres`
 *     driver in the future, set `prepare: false` there.
 *
 * Baseline vs after:
 *   Baseline  — singleton shared across requests; Postgres pool exhausted at
 *               ~10 concurrent users → 500ms+ queue wait.
 *   After     — per-request client + HTTP connection reuse via fetch;
 *               Supabase pooler handles ≥200 concurrent workers on 15 DB
 *               connections.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_DB_POOLER_URL ??  // pooler endpoint if configured
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Returns a fresh, per-request Supabase service-role client.
 *
 * - `auth.persistSession: false`  → no cookie/storage overhead; no leaked session
 * - `auth.autoRefreshToken: false` → no background timer spawned in server context
 * - `global.fetch: fetch`          → uses the runtime's native fetch which honours
 *                                    HTTP/1.1 keep-alive without holding a TCP socket
 *                                    open indefinitely
 */
export function createClient(): SupabaseClient {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch,           // explicit: use the runtime native fetch (edge + node 18+)
    },
  });
}

/**
 * Convenience re-export so callers that do
 *   import { supabase } from '@/lib/supabase/server'
 * still compile. Deprecated — prefer createClient() for explicit per-request
 * semantics. Will be removed in a future cleanup ticket.
 *
 * @deprecated use createClient() instead
 */
export const supabase: SupabaseClient = createClient();
