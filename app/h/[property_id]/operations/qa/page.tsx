// app/h/[property_id]/operations/qa/page.tsx
// PBS 2026-07-08: Donna delegate for QA · Overview. Delegates to the shared
// server component, forwarding propertyId + searchParams (?q= for search).

import { notFound } from 'next/navigation';
import QaOverviewBody from '@/app/operations/qa/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyQaOverviewPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: { q?: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <QaOverviewBody propertyId={pid} searchParams={searchParams} />;
}
