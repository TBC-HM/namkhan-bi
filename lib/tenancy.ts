// lib/tenancy.ts
// Per ADR-281 (L22): API-route authorization helper for multitenant safety.
// Every route that accepts property_id MUST call requirePropertyAccess before
// using the property_id in any DB query or logic.
//
// Design:
//   1. Resolve session: read workspace_session cookie → workspace_users lookup.
//   2. Read property_ids / holding_role claims from workspace_users row.
//   3. If the requested property_id is NOT in the grant list, 403.
//   4. Fail CLOSED: any error (no session, DB exception, etc.) = 403.
//
// Usage:
//   const propertyId = await requirePropertyAccess(req, req.nextUrl.searchParams.get('property_id'));
//   // propertyId is now a verified number; safe to use in queries.
//
// Author: GHA brief-builder · tenancy-api-authorization-v1 SLICE 1.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { verifyWorkspaceCookie } from '@/lib/workspace-cookie';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://build-placeholder.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'build-placeholder-key';

/**
 * Require that the current session has access to the given property_id.
 * Returns the verified property_id as a number.
 * Throws NextResponse (403) if unauthorized or any error occurs.
 */
export async function requirePropertyAccess(
  req: Request,
  rawPropertyId: string | null | undefined
): Promise<number> {
  // Parse the property_id
  const propertyId = Number(rawPropertyId);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    throw NextResponse.json({ error: 'invalid_property_id' }, { status: 403 });
  }

  // Resolve session
  let email: string | null = null;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get('workspace_session')?.value;
    const ws = raw ? await verifyWorkspaceCookie(raw) : null;
    email = ws?.email ?? null;
  } catch {
    // Fail closed
    throw NextResponse.json({ error: 'session_error' }, { status: 403 });
  }

  if (!email) {
    throw NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }

  // Look up grants
  let isHolding = false;
  let propertyIds: number[] = [];
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await admin
      .from('workspace_users')
      .select('role_level, property_ids, is_owner, active')
      .eq('email', email)
      .maybeSingle();

    if (error || !data || !data.active) {
      throw NextResponse.json({ error: 'no_workspace_access' }, { status: 403 });
    }

    const role = data.role_level ?? 'holding';
    isHolding = role === 'holding' || !!data.is_owner;
    propertyIds = Array.isArray(data.property_ids) ? data.property_ids.map(Number) : [];
  } catch (err) {
    // If the error is already a NextResponse (thrown above), re-throw it
    if (err instanceof Response || (err && typeof err === 'object' && 'status' in err)) {
      throw err;
    }
    // Otherwise, fail closed
    throw NextResponse.json({ error: 'authorization_check_failed' }, { status: 403 });
  }

  // Check access
  // Holding users with empty property_ids list = all properties
  if (isHolding && propertyIds.length === 0) {
    return propertyId;
  }

  // Explicit grant list
  if (propertyIds.includes(propertyId)) {
    return propertyId;
  }

  // No grant
  throw NextResponse.json({ error: 'property_access_denied' }, { status: 403 });
}
