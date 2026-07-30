// app/h/[property_id]/operations/spa/delivery/page.tsx — tenant spa delivery records.
import { redirect } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import DeliveryView from '@/app/operations/spa/_shared/DeliveryView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string }; }

export default async function TenantSpaDeliveryPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/spa/delivery');
  return <DeliveryView propertyId={propertyId} />;
}
