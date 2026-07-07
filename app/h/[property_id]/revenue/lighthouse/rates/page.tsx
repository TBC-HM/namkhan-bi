// app/h/[property_id]/revenue/lighthouse/rates/page.tsx
import { notFound } from 'next/navigation';
import LighthouseRatesBody from '@/app/revenue/lighthouse/rates/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyLighthouseRatesPage({
  params,
}: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <LighthouseRatesBody propertyId={pid} />;
}
