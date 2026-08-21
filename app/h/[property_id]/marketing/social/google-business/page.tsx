// app/h/[property_id]/marketing/social/google-business/page.tsx
// PBS 2026-08-21 · Tenant delegate mounts the real GBP body from _impl.tsx.
// Passes propertyId (from route) + searchParams (required by body signature)
// so the OAuth callback (?google=connected) and per-tenant reads work.
import { notFound } from 'next/navigation';
import GbpBody from '@/app/marketing/social/google-business/_impl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params { property_id: string }
type Sp = Record<string, string | string[] | undefined>;

export default function TenantSocialGbpPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: Sp;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <GbpBody searchParams={searchParams ?? {}} propertyId={pid} />;
}
