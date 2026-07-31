// app/h/[property_id]/operations/spa/passes/page.tsx — tenant spa passes.
// Namkhan 307s to the legacy unprefixed route (URL law §0.7).
import { redirect } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import PassesView from '@/app/operations/spa/_shared/PassesView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string }; }

export default async function TenantSpaPassesPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/spa/passes');
  return <PassesView propertyId={propertyId} />;
}
