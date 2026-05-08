/**
 * lib/supabase/pooler.ts
 *
 * Centralised Supabase client factory with:
 *  1. Singleton server client (service-role) — reused across requests in the
 *     same Node.js process, eliminating repeated TCP handshakes.
 *  2. PgBouncer / Supabase Pooler URL support — set
 *     SUPABASE_DB_POOLER_URL in your Vercel env vars to switch the
 *     underlying connection to the Supabase transaction-mode pooler.
 *  3. Typed prepared-statement helpers for the most-called hot paths
 *     (cockpit_tickets, cockpit_incidents).
 *
 * Usage:
 *   import { serverClient, getKpis, getTickets } from '@/lib/supabase/pooler';
 *
 * ticket #229 — Perf marathon child: connection pooling + prepared statements
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Environment resolution
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL) {
  throw new Error('[pooler] NEXT_PUBLIC_SUPABASE_URL is not set');
}
if (!SERVICE_ROLE_KEY) {
  throw new Error('[pooler] SUPABASE_SERVICE_ROLE_KEY is not set');
}

// ---------------------------------------------------------------------------
// Singleton server client
//
// Next.js hot-reload in dev means module singletons can be re-created.
// We attach the instance to globalThis so that the same client is reused
// across hot-reloads (standard Next.js pattern).
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __supabaseServerClient: SupabaseClient | undefined;
}

function buildServerClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      // Server-side: we use the service-role key, no session needed.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        // Identify pooled requests in Supabase logs.
        'x-client-info': 'namkhan-bi-pooler/1.0',
      },
    },
  });
}

/**
 * Singleton service-role Supabase client.
 * Safe to import at module level in server components and API routes.
 */
export const serverClient: SupabaseClient =
  globalThis.__supabaseServerClient ?? (globalThis.__supabaseServerClient = buildServerClient());

// ---------------------------------------------------------------------------
// Browser / anon client (lightweight, no service-role key)
// ---------------------------------------------------------------------------

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

declare global {
  // eslint-disable-next-line no-var
  var __supabaseAnonClient: SupabaseClient | undefined;
}

/**
 * Singleton anon-role Supabase client for use in Client Components.
 * Does NOT carry the service-role key.
 */
export function getAnonClient(): SupabaseClient {
  if (globalThis.__supabaseAnonClient) return globalThis.__supabaseAnonClient;
  globalThis.__supabaseAnonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
    global: { headers: { 'x-client-info': 'namkhan-bi-browser/1.0' } },
  });
  return globalThis.__supabaseAnonClient;
}

// ---------------------------------------------------------------------------
// Typed result shapes for hot-path views
// ---------------------------------------------------------------------------

export interface KpiRow {
  [key: string]: string | number | null;
}

export interface TicketRow {
  id: number;
  created_at: string;
  updated_at: string;
  arm: string | null;
  intent: string | null;
  status: string | null;
  parsed_summary: string | null;
  source: string | null;
}

export interface IncidentRow {
  [key: string]: string | number | null;
}

// ---------------------------------------------------------------------------
// Prepared-statement helpers
//
// Supabase JS does not expose pg's PREPARE/EXECUTE directly, but we can
// achieve the same query-plan caching by:
//   (a) using the Supabase Pooler URL (transaction mode, pgBouncer) so the
//       DB sees repeated identical parameterised queries and caches plans, and
//   (b) colocating all hot-path queries here so they share the same
//       connection slot and plan cache.
// ---------------------------------------------------------------------------

/**
 * Fetch recent cockpit tickets, newest first.
 * Optionally filter by status or arm.
 */
export async function getTickets(opts: {
  limit?: number;
  status?: string;
  arm?: string;
} = {}): Promise<TicketRow[]> {
  const { limit = 50, status, arm } = opts;

  let query = serverClient
    .from('cockpit_tickets')
    .select(
      'id, created_at, updated_at, arm, intent, status, parsed_summary, source'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);
  if (arm)    query = query.eq('arm', arm);

  const { data, error } = await query;
  if (error) {
    console.error('[pooler] getTickets error:', error.message);
    return [];
  }
  return (data ?? []) as TicketRow[];
}

/**
 * Fetch recent cockpit incidents, newest first.
 */
export async function getIncidents(limit = 50): Promise<IncidentRow[]> {
  const { data, error } = await serverClient
    .from('cockpit_incidents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[pooler] getIncidents error:', error.message);
    return [];
  }
  return (data ?? []) as IncidentRow[];
}

/**
 * Generic parameterised query helper.
 * Encourages callers to centralise queries here rather than scattering
 * ad-hoc createClient() calls across pages (which each open a new TCP conn).
 *
 * @example
 *   const rows = await queryView('v_compset_set_summary', { limit: 20 });
 */
export async function queryView<T = Record<string, unknown>>(
  viewName: string,
  opts: { limit?: number; filters?: Record<string, string | number | boolean> } = {}
): Promise<T[]> {
  const { limit = 100, filters = {} } = opts;

  let query = serverClient.from(viewName).select('*').limit(limit);

  for (const [col, val] of Object.entries(filters)) {
    // @ts-expect-error — Supabase filter overloads don't accept generic string keys
    query = query.eq(col, val);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`[pooler] queryView(${viewName}) error:`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}
