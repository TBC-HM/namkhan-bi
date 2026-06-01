// app/h/[property_id]/revenue/markets/page.tsx — per-property wrapper · #97
import { notFound } from 'next/navigation';
import MarketsPage from '@/app/revenue/markets/page';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function Page({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return <MarketsPage propertyId={propertyId} />;
}
