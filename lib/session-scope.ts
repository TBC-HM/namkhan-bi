// lib/session-scope.ts
// Single source of truth for the current user's property + dept scope.
// Read on every request that needs to filter UI or backend queries.
//
// Holding-level users (or anyone without a workspace_users row — legacy PBS)
// see all property_ids. Property-level users see only their assigned hotels.
// HOD-level users see only their assigned depts within their hotels.
//
// Used by:
//   - middleware: not yet (middleware runs on edge; we keep it cookie-only there)
//   - server components / API routes: yes
//   - the N-dropdown + cockpit-v2 property switcher: yes, via /api/session/scope
//
// Author: IT-team agent · 2026-05-13.

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { verifyWorkspaceCookie } from "@/lib/workspace-cookie";

export type RoleLevel = "holding" | "property" | "hod";

export type SessionScope = {
  email: string | null;
  authUserId: string | null;
  roleLevel: RoleLevel;
  isHolding: boolean;        // role_level==='holding' OR is_owner OR no row
  propertyIds: number[];     // [] when role_level==='holding' AND no explicit list (== all)
  deptIds: string[];         // [] means no dept restriction
  isAllProperties: boolean;  // convenience flag for the "no filter" UI state
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key";

let cached: SessionScope | null = null;
let cachedAt = 0;
const TTL_MS = 5_000; // tiny TTL inside a single request lifecycle

/**
 * Read the session scope. Cached per-request (~5s) so the same render tree
 * doesn't re-fetch this for every component.
 */
export async function getSessionScope(): Promise<SessionScope> {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;

  const cookieStore = cookies();
  const raw = cookieStore.get("workspace_session")?.value;
  const ws = raw ? await verifyWorkspaceCookie(raw) : null;

  // Default = legacy holding (PBS today, who has no signed cookie yet in open mode)
  const fallback: SessionScope = {
    email: ws?.email ?? null,
    authUserId: null,
    roleLevel: "holding",
    isHolding: true,
    propertyIds: [],
    deptIds: [],
    isAllProperties: true,
  };

  if (!ws?.email) {
    cached = fallback;
    cachedAt = Date.now();
    return fallback;
  }

  // Look up the full workspace row to pick up role_level + property_ids + dept_ids.
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data } = await admin
      .from("workspace_users")
      .select("auth_user_id, role_level, property_ids, dept_ids, is_owner, active")
      .eq("email", ws.email)
      .maybeSingle();

    if (!data || !data.active) {
      cached = fallback;
      cachedAt = Date.now();
      return fallback;
    }

    const role: RoleLevel = (data.role_level as RoleLevel) ?? "holding";
    const isHolding = role === "holding" || !!data.is_owner;
    const propertyIds = Array.isArray(data.property_ids) ? data.property_ids.map(Number) : [];
    const deptIds = Array.isArray(data.dept_ids) ? data.dept_ids.map(String) : [];

    const scope: SessionScope = {
      email: ws.email,
      authUserId: data.auth_user_id ?? null,
      roleLevel: role,
      isHolding,
      propertyIds,
      deptIds,
      isAllProperties: isHolding && propertyIds.length === 0,
    };
    cached = scope;
    cachedAt = Date.now();
    return scope;
  } catch {
    cached = fallback;
    cachedAt = Date.now();
    return fallback;
  }
}

/**
 * Convenience: filter a list of properties to those the user can access.
 * Holding users (or "all properties") pass through unchanged.
 */
export function filterPropertiesByScope<T extends { property_id: number }>(
  items: T[],
  scope: SessionScope,
): T[] {
  if (scope.isAllProperties) return items;
  if (scope.propertyIds.length === 0) return [];
  const set = new Set(scope.propertyIds);
  return items.filter((it) => set.has(it.property_id));
}

/**
 * Convenience: should this property be visible to the current user?
 */
export function canSeeProperty(propertyId: number, scope: SessionScope): boolean {
  if (scope.isAllProperties) return true;
  return scope.propertyIds.includes(propertyId);
}

/**
 * Convenience: should this dept be visible to the current user at the given property?
 */
export function canSeeDept(deptId: string | null | undefined, scope: SessionScope): boolean {
  if (!deptId) return true;
  if (scope.deptIds.length === 0) return true; // no restriction
  return scope.deptIds.includes(deptId);
}
