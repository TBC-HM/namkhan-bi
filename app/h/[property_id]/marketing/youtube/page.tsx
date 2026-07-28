// app/h/[property_id]/marketing/youtube/page.tsx
// PBS 2026-07-11 pm — Donna delegate for the YouTube channel module.
// Namkhan is the primary channel; Donna will follow once Faro family is
// authenticated to a Donna-scoped YouTube channel.
// 2026-07-28 (yt-completion brief, A10): /h/260955/marketing/youtube now
// resolves to the working Namkhan module via redirect (URL-canon compliance
// without migrating the live /marketing/youtube surface — §3 non-goal).
// Donna (1000001) keeps the stub unchanged.
import { redirect } from 'next/navigation';
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;

export default function PropertyMarketingYouTube({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (pid === NAMKHAN) {
    redirect('/marketing/youtube');
  }
  return (
    <DeptSubpageStub
      propertyId={pid}
      deptLabel="Marketing"
      routeLabel="YouTube"
      namkhanPath="/marketing/youtube"
      hint="Donna YouTube activation pending Faro OAuth + Donna-scoped ElevenLabs voice clone."
    />
  );
}
