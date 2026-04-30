// app/guest/layout.tsx
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import FilterStrip from '@/components/nav/FilterStrip';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

export default function GuestLayout({ children }: { children: React.ReactNode }) {
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
      <FilterStrip baseHref="/guest" liveSource="Reviews + social · live" />
      <div className="panel">{children}</div>
    </>
  );
}
