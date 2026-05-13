// app/operations/staff/data/page.tsx — Namkhan default (Data tab)
import DataTabContent from '../_components/DataTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function StaffDataPage() {
  return <DataTabContent propertyId={NAMKHAN_PROPERTY_ID} propertyLabel="Namkhan" />;
}
