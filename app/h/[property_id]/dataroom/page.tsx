// app/h/[property_id]/dataroom/page.tsx — property-level data-room cockpit.
// Brief dataroom-module-v1 §2: /h/[property_id]/dataroom (Namkhan 260955,
// Donna 1000001). List + create rooms; detail at ./[roomId].
import DataroomCockpit from '@/components/dataroom/DataroomCockpit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyDataroomPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  return <DataroomCockpit level="property" propertyId={pid} basePath={`/h/${pid}/dataroom`} />;
}
