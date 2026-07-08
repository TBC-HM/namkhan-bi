// app/h/[property_id]/operations/inventory/assets/[asset_id]/page.tsx
// Donna delegate — thin passthrough to Namkhan body. The body queries fa.assets
// by asset_id (UUID) with no property filter, so the same UUID resolves the same
// row for any tenant. The delegate exists so ThemeInjector applies the Donna
// (cream) theme + subnav for the /h/[property_id] chrome.
import { notFound } from 'next/navigation';
import NamkhanAssetDetail from '@/app/operations/inventory/assets/[asset_id]/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params { property_id: string; asset_id: string }

export default function DonnaAssetDetailPage({
  params,
}: {
  params: Params;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <NamkhanAssetDetail params={{ asset_id: params.asset_id }} />;
}
