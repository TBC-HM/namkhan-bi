// app/h/[property_id]/revenue/channels/[source]/page.tsx
// PBS 2026-07-08: Donna delegate for per-source landing pages.
// Structural mirror of Namkhan `/revenue/channels/[source]` — property-scoped data.

import { notFound } from 'next/navigation';
import ChannelSourceBody from '@/app/revenue/channels/[source]/page';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PropertyChannelSourcePage({
  params, searchParams,
}: {
  params: { property_id: string; source: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();

  // PBS 2026-09-06: unknown-source guard.
  // [source] treats its segment as a raw PMS source NAME and never checked that the
  // name exists, so ANY segment rendered a full channel-detail page — seven containers
  // of empty state under a heading naming the invented source. /revenue/channels/
  // promotions (a nav link to a page that was never committed) landed here and read as
  // a real, merely-empty page. A convincing dead page is worse than a 404.
  //
  // public.sources is the PMS source registry (128 rows for Namkhan, DMC partners
  // included). Matching on it keeps legitimately dormant sources working — "tracked but
  // has not produced bookings" is a valid state this page is built to show — while a
  // name that was never a source 404s.
  //
  // FAILS OPEN when the property has no registry rows: only 260955 is seeded today, so
  // enforcing unconditionally would 404 every channel page for Donna.
  const sourceName = decodeURIComponent(params.source);
  const { data, error } = await getSupabaseAdmin()
    .from('sources')
    .select('name')
    .eq('property_id', pid);

  // A failed lookup must not take the page down — degrade to the old behaviour.
  if (!error) {
    const registry = (data ?? []) as Array<{ name: string | null }>;
    const known = registry.some(
      (s) => (s.name ?? '').trim().toLowerCase() === sourceName.trim().toLowerCase(),
    );
    if (registry.length > 0 && !known) notFound();
  }

  return <ChannelSourceBody params={{ source: params.source }} searchParams={searchParams} propertyId={pid} />;
}
