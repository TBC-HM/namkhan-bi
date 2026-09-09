// lib/upload-scope.ts
// Where does an upload belong? Derived from the URL, never asked and never
// defaulted to a constant.
//
// PBS 2026-09-09: /marketing/upload and its dropzone sent NO property_id at all
// and relied on the server's `?? 260955`. Once that default was removed (L22)
// the page 400'd. The fix is not to re-add a default or to prompt the operator —
// it is to read the scope the operator is already standing in.
//
// The rules mirror components/nav/TenantLink.rewriteHref, which is the canonical
// place tenant vs holding is decided for navigation. Keep the two in step.
//
//   /h/<pid>/...   -> that tenant
//   /holding/...   -> holding      (0; the DB contract is 0 = holding scope,
//                                   stored as property_id NULL — see
//                                   fn_media_asset_upload_signup, memory 873)
//   anything else  -> the legacy unprefixed tree, which IS Namkhan's live
//                     surface. This is resolution, not a default: /h/260955/*
//                     with no dedicated page redirects INTO these same
//                     unprefixed paths (app/h/[property_id]/[...rest]/page.tsx),
//                     so the two URLs denote the same property by construction.

'use client';

import { usePathname } from 'next/navigation';

/** Namkhan owns the legacy unprefixed URL tree (/marketing/*, /revenue/*, ...). */
const LEGACY_TREE_PROPERTY_ID = 260955;

/** Holding scope. The DB maps 0 -> property_id NULL; NULL itself raises. */
export const HOLDING_SCOPE = 0;

/**
 * Pure resolver — exported so it can be unit-checked and reused server-side.
 * Returns null only when there is no pathname to reason about.
 */
export function resolveUploadScope(pathname: string | null | undefined): number | null {
  if (!pathname) return null;

  const tenant = pathname.match(/^\/h\/(\d+)(?:\/|$)/);
  if (tenant) {
    const pid = Number(tenant[1]);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  }

  if (pathname === '/holding' || pathname.startsWith('/holding/')) return HOLDING_SCOPE;

  return LEGACY_TREE_PROPERTY_ID;
}

/** Client hook form. Safe anywhere — unlike useCurrentProperty it never throws. */
export function useUploadScope(): number | null {
  return resolveUploadScope(usePathname());
}
