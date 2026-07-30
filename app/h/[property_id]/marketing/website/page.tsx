// app/h/[property_id]/marketing/website/page.tsx
// website-module-v1 P3 (2026-07-30) — canonical URL-law entry for the Website
// capability (brief §MENU: /h/[pid]/marketing/website LOCKED). Same resolution
// pattern as YouTube (yt-completion A10): Namkhan resolves to the live legacy
// surface via redirect; Donna keeps a stub until a Donna site exists
// (website.* is property-scoped from day one — Donna = new rows + theme).
import { redirect } from 'next/navigation';
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;

export default function PropertyMarketingWebsite({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (pid === NAMKHAN) {
    redirect('/marketing/website');
  }
  return (
    <DeptSubpageStub
      propertyId={pid}
      deptLabel="Marketing"
      routeLabel="Website"
      namkhanPath="/marketing/website"
      hint="Donna public site lands here later — website.* rows are property-scoped, so Donna = new rows + theme."
    />
  );
}
