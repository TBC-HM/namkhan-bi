import DashboardPage from '@/app/(cockpit)/_design/layout/DashboardPage';
import DataroomCockpit from '@/components/dataroom/DataroomCockpit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyDataroomPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  return (
    <DashboardPage title="Data Room">
      <div style={{ gridColumn: '1 / -1' }}>
        <DataroomCockpit level="property" propertyId={pid} basePath={`/h/${pid}/dataroom`} />
      </div>
    </DashboardPage>
  );
}
