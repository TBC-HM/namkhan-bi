// app/h/[property_id]/sales/pipeline/page.tsx
// PBS 2026-07-11 pm — Property-scoped delegate for Sales · Pipeline.

import PipelinePage from '@/app/sales/pipeline/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DelegateSalesPipeline({ params }: { params: Promise<{ property_id: string }> }) {
  const { property_id } = await params;
  return <PipelinePage propertyId={Number(property_id)} />;
}
