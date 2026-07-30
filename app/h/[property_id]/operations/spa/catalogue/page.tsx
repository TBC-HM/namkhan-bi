// app/h/[property_id]/operations/spa/catalogue/page.tsx — tenant spa catalogue.
import { redirect } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import CatalogueView from '@/app/operations/spa/_shared/CatalogueView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string }; }

export default async function TenantSpaCataloguePage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/spa/catalogue');
  return <CatalogueView propertyId={propertyId} />;
}
