// app/h/[property_id]/revenue/lighthouse/vs-yesterday/page.tsx
import { notFound } from 'next/navigation';
import LighthouseVsYesterdayBody from '@/app/revenue/lighthouse/vs-yesterday/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyLighthouseVsYesterdayPage({
  params,
}: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <LighthouseVsYesterdayBody propertyId={pid} />;
}
