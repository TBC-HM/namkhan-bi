// app/marketing/layout.tsx
// 2026-05-08 (ticket #328): bare-render the entry page (matches /revenue).
'use client';

import { usePathname } from 'next/navigation';
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import AssetDetailDrawer from '@/components/marketing/AssetDetailDrawer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/marketing' || pathname === '/marketing/') return <>{children}</>;
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
