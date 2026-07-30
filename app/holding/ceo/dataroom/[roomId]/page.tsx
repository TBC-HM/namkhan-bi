// app/holding/ceo/dataroom/[roomId]/page.tsx — holding room view.
import RoomView from '@/components/dataroom/RoomView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingRoomPage({ params }: { params: { roomId: string } }) {
  return <RoomView roomId={params.roomId} />;
}
