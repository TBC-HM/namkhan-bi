// app/h/[property_id]/guest/newsletters/director/page.tsx
// 2026-07-30 (brief autospec-newsletter_module-20260725 · A8/URL LAW): tenant
// delegate — mounts the canonical Director Studio body with propertyId scoping.
// Mirrors the pattern of /h/[property_id]/guest/newsletters/page.tsx and
// ./sequences/page.tsx. Legacy /guest/newsletters/director now 307s here
// (next.config.js redirects, Namkhan-only per rule 7).

import { notFound } from 'next/navigation';
import DirectorBody from '@/app/guest/newsletters/director/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantDirectorPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <DirectorBody propertyId={pid} />;
}
