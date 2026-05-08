// app/sales/layout.tsx
// 2026-05-08 (ticket #328): bare-render the entry page (matches /revenue).
'use client';

import { usePathname } from 'next/navigation';
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import FilterStrip from '@/components/nav/FilterStrip';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/sales' || pathname === '/sales/') return <>{children}</>;
  const h = PILLAR_HEADER.sales;
  const t = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Vientiane',
  });
  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={
          <>
            <strong>Inbound · live</strong>
            <br />
            Refreshed {t} ICT
          </>
        }
      />
      <SubNav items={RAIL_SUBNAV.sales} />
      <FilterStrip showForward={false} showCompare showSegment liveSource="Inbox · poll 60s" />
      <div className="panel">{children}</div>
    </>
  );
}
