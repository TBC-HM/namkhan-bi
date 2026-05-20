// app/h/[property_id]/revenue/channel/page.tsx
// Registry-driven channel page. Empty state until rows are added to
// v_container_registry (page_slug='channel') + v_graph_registry (section='channel').

import { notFound } from 'next/navigation';
import PageRenderer from '@/app/_components/registry/PageRenderer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ChannelPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return (
    <PageRenderer
      pageSlug="channel"
      propertyId={propertyId}
      title="Revenue · Channel"
      subtitle="channel economics · source mix · driven by registry"
    />
  );
}
