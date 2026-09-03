// lib/tenancy.ts
// ADR-281 L22: fail-closed property access enforcement for API routes.
// Resolves the user session, reads property_ids from workspace_users claims,
// and rejects (403) if the requested property_id is not granted.
//
// Session resolution (in order):
//   1. workspace_session HMAC cookie (fast path, set by /api/auth/callback)
//   2. Supabase JWT — for users whose Supabase session pre-dates the cookie
//      or who authenticated via a path that does not call /api/auth/callback.
//      getUser() validates the JWT against Supabase, so this is not weaker.
//
// Usage in API routes:
//   const propertyId = await requirePropertyAccess(req, rawPropertyId);
//
// Author: gha-brief-builder (tenancy-api-authorization-v1) · 2026-08-12.
// 2026-09-03: add Supabase JWT fallback (PBS had no workspace_session).

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { verifyWorkspaceCookie, signWorkspaceCookie } from '@/lib/workspace-cookie';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Enforce property-level access control in API routes.
 * Returns the verified property_id if granted; throws 403 Response if denied.
 * Fail-closed on any error (missing session, DB failure, etc.).
 */
export async function requirePropertyAccess(
  req: Request,
  rawPropertyId: string | number | null | undefined,
): Promise<number> {
  // Step 1: parse + validate property_id
  const propertyId = typeof rawPropertyId === 'number' 
    ? rawPropertyId 
    : Number(rawPropertyId);
  
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    throw new Response(
      JSON.stringify({ error: 'invalid_property_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Step 2: resolve email — workspace_session cookie first, then Supabase JWT
  const cookieStore = cookies();
  const rawCookie = cookieStore.get('workspace_session')?.value;
  const ws = rawCookie ? await verifyWorkspaceCookie(rawCookie) : null;

  let email: string;
  if (ws?.email) {
    email = ws.email;
  } else {
    // Fall back to Supabase JWT (getUser() validates against Supabase — not weaker)
    const sbClient = createServerClient(
      SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {}, // read-only here
        },
      },
    );
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user?.email) {
      throw new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }
    email = user.email.toLowerCase().trim();
  }

  // Step 3: read workspace_users claims (property_ids, role_level, is_owner + access flags)
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await admin
      .from('workspace_users')
      .select('role_level, property_ids, is_owner, active, access_revenue, access_sales, access_marketing, access_operations, access_finance')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      // DB error → fail closed
      console.error('[tenancy] workspace_users lookup failed:', error);
      throw new Response(
        JSON.stringify({ error: 'authorization_check_failed' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!data || !data.active) {
      // No row or inactive → deny
      throw new Response(
        JSON.stringify({ error: 'user_not_active' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Step 4: check grants
    // Holding-level users (role_level='holding' OR is_owner) get all properties
    const isHolding = data.role_level === 'holding' || data.is_owner === true;
    const propertyIds = Array.isArray(data.property_ids)
      ? data.property_ids.map(Number)
      : [];
    const granted = isHolding || propertyIds.includes(propertyId);

    if (!granted) {
      throw new Response(
        JSON.stringify({ error: 'property_access_denied', property_id: propertyId }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // If we resolved via JWT fallback, cache a workspace_session cookie so the
    // next request uses the fast HMAC path (~0 ms) instead of getUser() (~300 ms).
    if (!ws?.email) {
      try {
        const signed = await signWorkspaceCookie({
          email,
          is_owner: data.is_owner ?? false,
          access_revenue: data.access_revenue ?? false,
          access_sales: data.access_sales ?? false,
          access_marketing: data.access_marketing ?? false,
          access_operations: data.access_operations ?? false,
          access_finance: data.access_finance ?? false,
          iat: Math.floor(Date.now() / 1000),
        });
        cookieStore.set('workspace_session', signed, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60, // 30 days
          path: '/',
        });
      } catch {
        // Cookie-setting is best-effort — auth already succeeded, don't fail the request
      }
    }

    return propertyId;
  } catch (err) {
    // If it's already a Response (our 403s), re-throw
    if (err instanceof Response) {
      throw err;
    }
    // Otherwise, fail closed
    console.error('[tenancy] unexpected error:', err);
    throw new Response(
      JSON.stringify({ error: 'authorization_check_failed' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
