/**
 * lib/api/cockpit-cache-headers.ts
 *
 * Perf marathon #229 child — HTTP cache headers for /api/cockpit/* read endpoints.
 *
 * Usage in any GET route handler:
 *
 *   import { cockpitCacheHeaders, withCockpitCache } from '@/lib/api/cockpit-cache-headers';
 *
 *   // Option A — manual (full control):
 *   export async function GET() {
 *     const data = await fetchSomething();
 *     return NextResponse.json(data, { headers: cockpitCacheHeaders() });
 *   }
 *
 *   // Option B — wrapper (zero boilerplate):
 *   export const GET = withCockpitCache(async () => {
 *     const data = await fetchSomething();
 *     return NextResponse.json(data);
 *   });
 */

import { NextResponse } from 'next/server';

/**
 * Default TTL seconds for cockpit read endpoints.
 * - s-maxage=30 → CDN/Vercel Edge caches for 30 s (fresh enough for ops dashboards)
 * - stale-while-revalidate=60 → serve stale while CDN revalidates in background
 * - max-age=0 → browser always revalidates (prevents stale tabs)
 */
const DEFAULT_SWR_SECONDS = 30;
const DEFAULT_STALE_WHILE_REVALIDATE = 60;

export interface CockpitCacheOptions {
  /** CDN TTL in seconds (s-maxage). Default: 30 */
  sMaxAge?: number;
  /** stale-while-revalidate window in seconds. Default: 60 */
  staleWhileRevalidate?: number;
  /**
   * Set true for highly volatile endpoints (e.g. live incident feed).
   * Emits: Cache-Control: no-store
   */
  noStore?: boolean;
}

/**
 * Returns a Headers object with appropriate Cache-Control for cockpit read APIs.
 */
export function cockpitCacheHeaders(opts: CockpitCacheOptions = {}): Headers {
  const headers = new Headers();

  if (opts.noStore) {
    headers.set('Cache-Control', 'no-store');
    return headers;
  }

  const sMaxAge = opts.sMaxAge ?? DEFAULT_SWR_SECONDS;
  const swr = opts.staleWhileRevalidate ?? DEFAULT_STALE_WHILE_REVALIDATE;

  // max-age=0 keeps browsers honest; s-maxage governs CDN/edge caching.
  headers.set(
    'Cache-Control',
    `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
  );

  // Surrogate-Control mirrors s-maxage for Vercel Edge Network.
  headers.set('Surrogate-Control', `max-age=${sMaxAge}`);

  // Vary: Accept ensures CDN keeps separate cache entries per content-type.
  headers.set('Vary', 'Accept');

  return headers;
}

/**
 * Returns a plain object version of the cache headers, suitable for spreading:
 * NextResponse.json(data, { headers: { ...cockpitCacheHeadersObj() } })
 */
export function cockpitCacheHeadersObj(opts: CockpitCacheOptions = {}): Record<string, string> {
  const headers = cockpitCacheHeaders(opts);
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

type RouteHandler = (req: Request, ctx?: unknown) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order wrapper that injects cache headers into any cockpit GET handler.
 *
 * @example
 * export const GET = withCockpitCache(async (req) => {
 *   const data = await db.query();
 *   return NextResponse.json(data);
 * }, { sMaxAge: 10 });
 */
export function withCockpitCache(
  handler: RouteHandler,
  opts: CockpitCacheOptions = {},
): RouteHandler {
  return async (req: Request, ctx?: unknown): Promise<NextResponse> => {
    const response = await handler(req, ctx);

    // Apply cache headers to the response in-place.
    const cacheHeaders = cockpitCacheHeaders(opts);
    cacheHeaders.forEach((value, key) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

/**
 * Convenience: returns a NextResponse with no-store for volatile cockpit endpoints
 * (e.g. /api/cockpit/incidents/live).
 */
export function noStoreResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: cockpitCacheHeadersObj({ noStore: true }),
  });
}
