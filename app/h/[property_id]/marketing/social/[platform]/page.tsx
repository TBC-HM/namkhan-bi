// app/h/[property_id]/marketing/social/[platform]/page.tsx
// PBS 2026-08-21 · Tenant delegate mounts the shared Namkhan body from
// _impl.tsx. Bare /marketing/social/[platform] now redirects here so the
// tenant chrome (top strip + Marketing sub-strip + theme) always renders.
// Namkhan body filters by unique ID, so the same ID resolves the same row
// regardless of tenant.
import { notFound } from 'next/navigation';
import NamkhanSocial from '@/app/marketing/social/[platform]/_impl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params { property_id: string; platform: string }

export default function TenantSocialPlatformPage({
  params,
}: {
  params: Params;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <NamkhanSocial params={{ platform: params.platform }} />;
}
