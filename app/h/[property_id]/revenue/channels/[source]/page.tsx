// app/h/[property_id]/revenue/channels/[source]/page.tsx
// PBS 2026-07-08: Donna delegate for per-source landing pages.
// Structural mirror of Namkhan `/revenue/channels/[source]` — property-scoped data.

import { notFound } from 'next/navigation';
import ChannelSourceBody from '@/app/revenue/channels/[source]/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyChannelSourcePage({
  params, searchParams,
}: {
  params: { property_id: string; source: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <ChannelSourceBody params={{ source: params.source }} searchParams={searchParams} propertyId={pid} />;
}
