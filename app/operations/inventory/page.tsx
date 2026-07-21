// app/operations/inventory/page.tsx
//
// Legacy /operations/inventory root -> canonical Namkhan tenant URL.
// The 11 sub-routes under /operations/inventory/* (stock, par, counts, etc.)
// remain live and continue to use their own _data.ts + _components (unchanged).
// Only the ROOT overview page now bounces to the new registry-driven surface
// at /h/{NAMKHAN_PROPERTY_ID}/operations/inventory.
//
// Next.js 15 App Router: redirect() from 'next/navigation' throws internally
// and yields a 307 to the browser.

import { redirect } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function LegacyInventoryRootRedirect() {
  redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory`);
}
