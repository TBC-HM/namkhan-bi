// app/h/[property_id]/marketing/youtube/page.tsx
// PBS 2026-07-11 pm — Donna delegate for the YouTube channel module.
// Namkhan is the primary channel; Donna will follow once Faro family is
// authenticated to a Donna-scoped YouTube channel.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingYouTube({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="YouTube"
      namkhanPath="/marketing/youtube"
      hint="Donna YouTube activation pending Faro OAuth + Donna-scoped ElevenLabs voice clone."
    />
  );
}
