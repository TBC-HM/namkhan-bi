// app/h/[property_id]/operations/spa/schedule/page.tsx — tenant spa schedule.
// Namkhan 307s to the legacy unprefixed route (URL law §0.7).
import { redirect } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import ScheduleView from '@/app/operations/spa/_shared/ScheduleView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string }; searchParams: Record<string, string | string[] | undefined>; }

export default async function TenantSpaSchedulePage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/spa/schedule');
  return <ScheduleView propertyId={propertyId} searchParams={searchParams} />;
}
