// app/h/[property_id]/dataroom/[roomId]/page.tsx — property room view.
import RoomView from '@/components/dataroom/RoomView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyRoomPage({ params }: { params: { property_id: string; roomId: string } }) {
  return <RoomView roomId={params.roomId} />;
}
