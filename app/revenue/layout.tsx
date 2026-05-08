'use client';

// app/revenue/layout.tsx
// 2026-05-08 — conditional chrome. /revenue is the chat with Vector (no
// chrome). All sub-pages (/revenue/pulse, /revenue/pace etc) keep the
// full Federico v2 mockup shell.

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import FilterStrip from '@/components/nav/FilterStrip';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

import REDESIGN_CSS from './_redesign/redesignCss';
import OVERRIDE_CSS from './_redesign/overrideCss';
import AGENT_DOCK_HTML from './_redesign/agentDockHtml';
import MODAL_HTML from './_redesign/modalHtml';
import TOOLTIP_HTML from './_redesign/tooltipHtml';

export default function RevenueLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/revenue' || pathname === '/revenue/') {
    return <>{children}</>;
  }
  const h = PILLAR_HEADER.revenue;
  const t = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane',
  });
  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={<><strong>Revenue management</strong><br />Refreshed {t} ICT</>}
      />
      <SubNav items={RAIL_SUBNAV.revenue} />
      <FilterStrip showForward showCompare showSegment liveSource="Cloudbeds · live" />

      <style dangerouslySetInnerHTML={{ __html: REDESIGN_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: OVERRIDE_CSS }} />

      <div className="panel bc-redesign">
        {children}

        <div dangerouslySetInnerHTML={{ __html: AGENT_DOCK_HTML }} />
        <div dangerouslySetInnerHTML={{ __html: MODAL_HTML }} />
        <div dangerouslySetInnerHTML={{ __html: TOOLTIP_HTML }} />
      </div>

      <Script src="/revenue-redesign.js" strategy="afterInteractive" />
    </>
  );
}
