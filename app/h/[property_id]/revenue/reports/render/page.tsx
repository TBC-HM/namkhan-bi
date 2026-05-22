// app/h/[property_id]/revenue/reports/render/page.tsx
// Property-scoped delegate for the revenue reports render route. Re-uses the
// canonical /revenue/reports/render body so Donna's "Open report →" buttons
// land on a real surface instead of 404. Inner renderers are not yet
// property-aware — that is task #71 (Phase B).

import { notFound } from 'next/navigation';
import RevenueReportRender from '@/app/revenue/reports/render/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default function PropertyRevenueReportRender({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();

  // Inject property_id into searchParams so future property-aware renderers
  // can pick it up. The current canonical body ignores it but the URL works.
  return (
    <RevenueReportRender
      searchParams={{ ...searchParams, property_id: String(propertyId) }}
    />
  );
}
