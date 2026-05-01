// app/front-office/layout.tsx
// Front Office pillar shell — Banner + SubNav + FilterStrip + panel children.
// Mirrors /sales/layout.tsx pattern. Hides forward-window buttons since
// arrivals are bounded to the next-72h default window per the IA proposal.

import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import FilterStrip from '@/components/nav/FilterStrip';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

export default function FrontOfficeLayout({ children }: { children: React.ReactNode }) {
  const h = PILLAR_HEADER.frontOffice;
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
            <strong>Arrivals · live</strong>
            <br />
            Refreshed {t} ICT
          </>
        }
      />
      <SubNav items={RAIL_SUBNAV.frontOffice} />
      <FilterStrip showForward={false} showCompare showSegment liveSource="Cloudbeds · poll 60s" />
      <div className="panel">{children}</div>
    </>
  );
}
