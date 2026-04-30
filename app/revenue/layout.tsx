// app/revenue/layout.tsx
// Revenue pillar shell — banner + sub-nav + filter strip live above each child page.

import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import FilterStrip from '@/components/nav/FilterStrip';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

export default function RevenueLayout({ children }: { children: React.ReactNode }) {
  const h = PILLAR_HEADER.revenue;
  const refreshTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane' });

  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={
          <>
            <strong>Revenue Management</strong><br />
            Refreshed {refreshTime} ICT
          </>
        }
      />
      <SubNav items={RAIL_SUBNAV.revenue} />
      <FilterStrip baseHref="/revenue" liveSource="Cloudbeds · live" />
      <div className="panel">{children}</div>
    </>
  );
}
