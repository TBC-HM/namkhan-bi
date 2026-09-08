// app/h/[property_id]/marketing/overview/page.tsx
// Brief marketing-dashboard-v1 · the old overview page is retired.
// Permanent (308) redirect to the new dashboard, preserving ?tab= if present.
import { permanentRedirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ property_id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function RetiredMarketingOverviewPage({ params, searchParams }: PageProps) {
  const { property_id } = await params;
  const sp = (await searchParams) ?? {};
  const tab = sp.tab ? `?tab=${encodeURIComponent(sp.tab)}` : '';
  permanentRedirect(`/h/${property_id}/marketing/dashboard${tab}`);
}
