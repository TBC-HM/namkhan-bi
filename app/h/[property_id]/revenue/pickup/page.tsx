// app/h/[property_id]/revenue/pickup/page.tsx
// Property-scoped delegate — both Namkhan and Donna render the same tree.

import { notFound } from 'next/navigation';
import PickupBody from '@/app/revenue/pickup/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyPickupPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();

  // PBS 2026-08-25 — ?matrixYear=YYYY drives the pickup matrix stay year.
  // Must be threaded through here: the dropdown pushes the param onto this
  // route, and the legacy body validates it against its allowed year list.
  const raw = searchParams?.matrixYear;
  const matrixYear = Number(Array.isArray(raw) ? raw[0] : raw);

  return (
    <PickupBody
      propertyId={propertyId}
      matrixYear={Number.isFinite(matrixYear) ? matrixYear : undefined}
    />
  );
}
