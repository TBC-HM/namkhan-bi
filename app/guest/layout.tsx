// app/guest/layout.tsx
// 2026-05-08 (ticket #328): bare-render the entry page (matches /revenue).
'use client';

import { usePathname } from 'next/navigation';
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import FilterStrip from '@/components/nav/FilterStrip';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/guest' || pathname === '/guest/') return <>{children}</>;
  const h = PILLAR_HEADER.guest;
  const t = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane',
  });
  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={<><strong>Voice of the house</strong><br />Refreshed {t} ICT</>}
      />
      <SubNav items={RAIL_SUBNAV.guest} />
      {/* Guest pages use back-only windows; segment is highly relevant */}
      <FilterStrip showForward={false} showCompare showSegment liveSource="Reviews + social · live" />
      <div className="panel">{children}</div>
    </>
  );
}
