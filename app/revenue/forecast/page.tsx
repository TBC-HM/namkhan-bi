// app/revenue/forecast/page.tsx
// 2026-08-12: delegate to property-scoped body (F7 completion).

import { notFound } from 'next/navigation';
import { PROPERTY_ID } from '@/lib/supabase';
import ForecastBody from '@/app/h/[property_id]/revenue/forecast/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function GlobalForecastPage({
  params,
  searchParams,
}: {
  params?: { property_id?: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const propertyId = params?.property_id ? Number(params.property_id) : PROPERTY_ID;
  if (!Number.isFinite(propertyId)) notFound();
  return <ForecastBody params={{ property_id: String(propertyId) }} />;
}
