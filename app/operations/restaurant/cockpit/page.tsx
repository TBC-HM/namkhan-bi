// app/operations/restaurant/cockpit/page.tsx
// PBS 2026-08-26 · Kept as a redirect after the swap.
//
// While the redesign was built alongside the live page it lived here. It is now
// /operations/restaurant itself, so this route forwards rather than 404s — any
// link, bookmark or note made during the preview still lands in the right
// place, with the tab and period preserved.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function FbCockpitRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams(
    Object.entries(searchParams ?? {}).flatMap(([k, v]) =>
      v == null ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]],
    ),
  ).toString();
  redirect(`/operations/restaurant${qs ? `?${qs}` : ''}`);
}
