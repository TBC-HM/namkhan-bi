// app/h/[property_id]/revenue/lighthouse/overview/page.tsx
import { notFound } from 'next/navigation';
import LighthouseOverviewBody from '@/app/revenue/lighthouse/overview/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyLighthouseOverviewPage({
  params,
}: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <LighthouseOverviewBody propertyId={pid} />;
}
