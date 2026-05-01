// app/marketing/layout.tsx
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import FilterStrip from '@/components/nav/FilterStrip';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import AssetDetailDrawer from '@/components/marketing/AssetDetailDrawer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const h = PILLAR_HEADER.marketing;
  const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane' });
  return (
    <>
      <Banner eyebrow={h.eyebrow} title={h.title} titleEmphasis={h.emphasis}
        meta={<><strong>Reputation & Channels</strong><br />Refreshed {t} ICT</>} />
      <SubNav items={RAIL_SUBNAV.marketing} />
      <FilterStrip liveSource="Cloudbeds · GA4 · live" />
      <div className="panel">{children}</div>
      <AssetDetailDrawer />
    </>
  );
}
