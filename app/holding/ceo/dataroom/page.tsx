// app/holding/ceo/dataroom/page.tsx — holding-level data-room cockpit.
// Brief dataroom-module-v1 §2 (PBS ruling): under the CEO stripe — TBC is a
// platform company; the hotels are pilot customers with their own rooms at
// /h/[property_id]/dataroom.
import DataroomCockpit from '@/components/dataroom/DataroomCockpit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingDataroomPage() {
  return <DataroomCockpit level="holding" propertyId={null} basePath="/holding/ceo/dataroom" />;
}
