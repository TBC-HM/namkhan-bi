// app/layout.tsx
// 2026-05-08 redesign — green frame REMOVED per PBS directive.
// Old: LeftRail + main column with green PILLAR header + horizontal tabs.
// New: edge-to-edge content; navigation handled by floating <NDropdown />
// (top-left brass N badge, click → dept menu) on every page.

import type { Metadata } from 'next';
import Script from 'next/script';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './../styles/globals.css';
import NDropdown from '@/components/nav/NDropdown';
import CapacityResetOnPillarChange from '@/components/nav/CapacityResetOnPillarChange';
import AgentEditModal from '@/components/agents/AgentEditModal';
import BugWidget from '@/components/cockpit/BugWidget';
import TopDeptStrip from '@/components/page/TopDeptStrip';
import PropertyThemeWatcher from '@/components/PropertyThemeWatcher';

export const metadata: Metadata = {
  title: 'The Namkhan · BI',
  description: 'Operator intelligence dashboard for The Namkhan, Luang Prabang.',
};
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* PBS 2026-05-15 — set <html data-property> BEFORE first paint so
            :root[data-property='...'] palette wins on frame 1. Eliminates
            FOUC where /h/[id] briefly painted in BC peach. Watcher below
            re-syncs on SPA navigations. Static literal, no user input. */}
        <Script id="property-theme-attr" strategy="beforeInteractive">
          {`
(function(){try{var p=location.pathname;var v='namkhan';
if(p==='/holding'||p.indexOf('/holding/')===0)v='holding';
else if(p==='/tbc'||p.indexOf('/tbc/')===0)v='holding';
else if(p.indexOf('/h/1000001')===0)v='donna';
else if(p.indexOf('/h/260955')===0)v='namkhan';
else if(p.indexOf('/h/0')===0)v='holding';
document.documentElement.setAttribute('data-property',v);}catch(e){}})();
          `}
        </Script>
        <PropertyThemeWatcher />
        <CapacityResetOnPillarChange />
        <NDropdown />
        {/* PBS 2026-05-14 — canonical top dept menu, persistent on EVERY
            route except holding/tbc/login. Mounted at root so it survives
            legacy redirects out of /h/[id]/ (Namkhan dept pages). */}
        <TopDeptStrip />
        {children}
        <AgentEditModal />
        <BugWidget />
        <SpeedInsights />
      </body>
    </html>
  );
}
