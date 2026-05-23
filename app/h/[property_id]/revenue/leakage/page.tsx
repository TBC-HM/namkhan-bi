// app/h/[property_id]/revenue/leakage/page.tsx
// Registry-driven leakage page. Adding/removing containers = DB-only.

import { notFound } from 'next/navigation';
import PageRenderer from '@/app/_components/registry/PageRenderer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function LeakagePage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return (
    <PageRenderer
      pageSlug="leakage"
      propertyId={propertyId}
      title="Revenue · Leakage"
      subtitle="rate leakage · source transparency · driven by v_container_registry + v_graph_registry"
      layout="graphs-first"
    />
  );
}
