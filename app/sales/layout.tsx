// app/sales/layout.tsx
// Sales pillar shell — Banner + SubNav + FilterStrip + panel children.
// Mirrors /operations/layout.tsx pattern. Hides forward-window buttons since
// inquiries are received-on (past + now), not forward-pace.

import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import FilterStrip from '@/components/nav/FilterStrip';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

export default function SalesLayout({ children }: { children: React.ReactNode }) {
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
