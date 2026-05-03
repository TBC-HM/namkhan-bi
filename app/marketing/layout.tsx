// app/marketing/layout.tsx
// Cowork audit 2026-05-03: removed FilterStrip from this layout. Marketing
// has STATIC pages (library, influencers, taxonomy, upload, agents, media)
// where Window/Compare/Segment selectors don't apply. Period-aware pages
// (snapshot, social, reviews, campaigns) render their own FilterStrip inline.
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
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
      <div className="panel">{children}</div>
      <AssetDetailDrawer />
    </>
  );
}
