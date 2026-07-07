// app/h/[property_id]/revenue/lighthouse/vs-3d/page.tsx
import { notFound } from 'next/navigation';
import LighthouseVs3dBody from '@/app/revenue/lighthouse/vs-3d/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyLighthouseVs3dPage({
  params,
}: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <LighthouseVs3dBody propertyId={pid} />;
}
