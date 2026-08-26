// app/h/[property_id]/operations/restaurant/cockpit/page.tsx
// PBS 2026-08-26 · Tenant wrapper for the F&B manager cockpit (L6).
//
// The unprefixed /operations/restaurant/cockpit IS the Namkhan implementation,
// so Namkhan redirects there and keeps one canonical URL. Any other property
// renders the same component with its own property_id — the cockpit takes
// propertyId as a prop and scopes every read by it, so there is nothing
// Namkhan-specific inside it.
//
// Without this file the cockpit 404s for Donna and for any /h-prefixed link.

import { redirect, notFound } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import FbCockpitPage from '@/app/operations/restaurant/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyFbCockpitPage({
  params, searchParams,
}: {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();

  if (propertyId === NAMKHAN_PROPERTY_ID) {
    const qs = new URLSearchParams(
      Object.entries(searchParams ?? {}).flatMap(([k, v]) =>
        v == null ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]],
      ),
    ).toString();
    redirect(`/operations/restaurant${qs ? `?${qs}` : ''}`);
  }

  return <FbCockpitPage searchParams={searchParams} propertyId={propertyId} />;
}
