/**
 * HTTP cache header helpers for /api/cockpit/* read endpoints.
 * Import `withCockpitCache` and wrap your GET handler.
 *
 * Usage:
 *   export const GET = withCockpitCache(async (req) => { ... }, { maxAge: 30 });
 *
 * Rules:
 *  - GET / HEAD only — POST/PUT/DELETE are passed through untouched.
 *  - Default: s-maxage=30, stale-while-revalidate=60  (CDN caches 30 s, serves stale up to 60 s)
 *  - Private data (auth-gated): set private:true → Cache-Control: private, no-store
 *  - Vary: Authorization always appended so CDN shards by token.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface CockpitCacheOptions {
  /** Public CDN TTL in seconds. Default 30. */
  maxAge?: number;
  /** Stale-while-revalidate window in seconds. Default 60. */
  swr?: number;
  /** If true, sets private, no-store (never cached by CDN). Default false. */
  private?: boolean;
}

type RouteHandler = (req: NextRequest) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a Next.js App-Router GET handler with appropriate HTTP cache headers.
 */
export function withCockpitCache(
  handler: RouteHandler,
  opts: CockpitCacheOptions = {}
): RouteHandler {
  const { maxAge = 30, swr = 60, private: isPrivate = false } = opts;

  return async (req: NextRequest): Promise<NextResponse> => {
    const response = await handler(req);

    // Only annotate GET / HEAD — mutations must never be cached
    const method = req.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      return response;
    }

    const res = response.clone() as NextResponse;

    if (isPrivate) {
      res.headers.set('Cache-Control', 'private, no-store');
    } else {
      res.headers.set(
        'Cache-Control',
        `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`
      );
    }

    // Always vary on Authorization so CDN does not serve a cached response
    // for user A to user B.
    const existingVary = res.headers.get('Vary') ?? '';
    const varyParts = existingVary
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (!varyParts.includes('Authorization')) {
      varyParts.push('Authorization');
    }
    res.headers.set('Vary', varyParts.join(', '));

    return res;
  };
}

/**
 * Convenience: apply standard cockpit read cache headers directly to a
 * NextResponse you already have in hand (e.g. from NextResponse.json()).
 *
 * @example
 *   const res = NextResponse.json(rows);
 *   return applyCockpitCacheHeaders(res);
 */
export function applyCockpitCacheHeaders(
  response: NextResponse,
  opts: CockpitCacheOptions = {}
): NextResponse {
  const { maxAge = 30, swr = 60, private: isPrivate = false } = opts;

  if (isPrivate) {
    response.headers.set('Cache-Control', 'private, no-store');
  } else {
    response.headers.set(
      'Cache-Control',
      `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`
    );
  }

  const existingVary = response.headers.get('Vary') ?? '';
  const varyParts = existingVary
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (!varyParts.includes('Authorization')) {
    varyParts.push('Authorization');
  }
  response.headers.set('Vary', varyParts.join(', '));

  return response;
}
