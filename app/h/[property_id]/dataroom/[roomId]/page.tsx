import DashboardPage from '@/app/(cockpit)/_design/layout/DashboardPage';
import RoomView from '@/components/dataroom/RoomView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyRoomPage({ params }: { params: { property_id: string; roomId: string } }) {
  return (
    <DashboardPage title="Data Room">
      <div style={{ gridColumn: '1 / -1' }}>
        <RoomView roomId={params.roomId} />
      </div>
    </DashboardPage>
  );
}
