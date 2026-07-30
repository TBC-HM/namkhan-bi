// app/operations/spa/delivery/page.tsx — Namkhan spa delivery records (spa module v1).
import DeliveryView from '../_shared/DeliveryView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SpaDeliveryPage() {
  return <DeliveryView propertyId={260955} />;
}
