// app/revenue/layout.tsx
// Redesign v2 (Federico, 30 Apr 2026): the mockup HTML/CSS/JS is rendered 1:1 inside the Next.js shell.
// Mockup CSS is scoped to .bc-redesign so it doesn't bleed into other pillars.
// Global mockup elements (agent dock, modal overlay, tooltip) are rendered once here.
// Mockup JS is loaded from /public/revenue-redesign.js after interactive.

import fs from 'node:fs';
import path from 'node:path';
import Script from 'next/script';
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import FilterStrip from '@/components/nav/FilterStrip';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

const REDESIGN_DIR = path.join(process.cwd(), 'app/revenue/_redesign');

function readFileSafe(rel: string): string {
  try {
    return fs.readFileSync(path.join(REDESIGN_DIR, rel), 'utf8');
  } catch {
    return '';
  }
}

const REDESIGN_CSS = readFileSafe('redesign.css');
const AGENT_DOCK_HTML = readFileSafe('global-agent-dock.html');
const MODAL_HTML = readFileSafe('global-modal-overlay.html');
const TOOLTIP_HTML = readFileSafe('global-tooltip.html');

export default function RevenueLayout({ children }: { children: React.ReactNode }) {
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

      {/* Mockup CSS — scoped to .bc-redesign so it doesn't bleed into other pillars */}
      <style dangerouslySetInnerHTML={{ __html: REDESIGN_CSS }} />

      <div className="panel bc-redesign">
        {children}

        {/* Global mockup chrome rendered once for all revenue tabs */}
        <div dangerouslySetInnerHTML={{ __html: AGENT_DOCK_HTML }} />
        <div dangerouslySetInnerHTML={{ __html: MODAL_HTML }} />
        <div dangerouslySetInnerHTML={{ __html: TOOLTIP_HTML }} />
      </div>

      {/* Mockup JS: tab switcher / dock toggle / modal / tooltip / agent definitions data */}
      <Script src="/revenue-redesign.js" strategy="afterInteractive" />
    </>
  );
}
