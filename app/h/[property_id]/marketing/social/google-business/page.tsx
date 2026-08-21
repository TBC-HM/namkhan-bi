// app/h/[property_id]/marketing/social/google-business/page.tsx
// PBS 2026-08-21 · Tenant delegate mounts the real GBP body from _impl.tsx
// (previously a stub blocked on allowlist — real page always rendered fine,
// stub was only preventing the tenant URL from working). Bare
// /marketing/social/google-business now redirects here so tenant chrome
// renders correctly for both Namkhan (260955) and Donna (1000001).
import { notFound } from 'next/navigation';
import GbpBody from '@/app/marketing/social/google-business/_impl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params { property_id: string }

export default function TenantSocialGbpPage({
  params,
}: {
  params: Params;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <GbpBody />;
}
