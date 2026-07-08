// app/h/[property_id]/marketing/social/[platform]/page.tsx
// Donna delegate — thin passthrough. Namkhan body filters by unique ID, no
// property scoping, so the same ID resolves the same row regardless of tenant.
// Delegate exists so ThemeInjector applies the Donna (cream) theme + subnav
// for the /h/[property_id] chrome.
import { notFound } from 'next/navigation';
import NamkhanSocial from '@/app/marketing/social/[platform]/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params { property_id: string; platform: string }

export default function DonnaDelegatePage({
  params,
}: {
  params: Params;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <NamkhanSocial params={{ platform: params.platform }} />;
}
