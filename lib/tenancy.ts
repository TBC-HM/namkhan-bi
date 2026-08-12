// lib/tenancy.ts
// ADR-281 L22: fail-closed property access enforcement for API routes.
// Resolves the user session, reads property_ids from workspace_users claims,
// and rejects (403) if the requested property_id is not granted.
//
// Usage in API routes:
//   const propertyId = await requirePropertyAccess(req, rawPropertyId);
//
// Author: gha-brief-builder (tenancy-api-authorization-v1) · 2026-08-12.

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { verifyWorkspaceCookie } from '@/lib/workspace-cookie';

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

  // Step 2: resolve session from workspace_session cookie
  const cookieStore = cookies();
  const raw = cookieStore.get('workspace_session')?.value;
  const ws = raw ? await verifyWorkspaceCookie(raw) : null;

  if (!ws?.email) {
    throw new Response(
      JSON.stringify({ error: 'unauthorized' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Step 3: read workspace_users claims (property_ids, role_level, is_owner)
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await admin
      .from('workspace_users')
      .select('role_level, property_ids, is_owner, active')
      .eq('email', ws.email)
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
    if (isHolding) {
      return propertyId; // granted
    }

    // Property-level users: check property_ids array
    const propertyIds = Array.isArray(data.property_ids)
      ? data.property_ids.map(Number)
      : [];
    
    if (propertyIds.includes(propertyId)) {
      return propertyId; // granted
    }

    // No grant → deny
    throw new Response(
      JSON.stringify({ error: 'property_access_denied', property_id: propertyId }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
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
