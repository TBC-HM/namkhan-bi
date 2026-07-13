// app/layout.tsx
// PBS 2026-07-06: sitewide paper-white scope. Every page now inherits pure
// white body + white token palette regardless of the property theme. The
// top dept strip stays outside the scope and colors itself per property
// (Namkhan=black · Donna=beige · Beyond=white) — that's now the only
// visual differentiator between properties.
//
// PBS 2026-07-13: mount GmailNavDropdown (top-right nav icon for per-user
// Gmail inbox + compose/reply). Silent when the user is not connected.
//
// Original comment (2026-05-08): green frame REMOVED per PBS directive.
// Old: LeftRail + main column with green PILLAR header + horizontal tabs.
// New: edge-to-edge content; navigation handled by floating <NDropdown />
// (top-left brass N badge, click → dept menu) on every page.

import type { Metadata } from 'next';
import Script from 'next/script';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './../styles/globals.css';
import NDropdown from '@/components/nav/NDropdown';
import GmailNavDropdown from '@/app/_components/GmailNavDropdown';
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
        {/* PBS 2026-07-06: sitewide paper-white palette. Overrides every
            legacy dark token AFTER the top strip renders so the strip
            keeps its property color (Namkhan=black · Donna=beige ·
            Beyond=white). Anything outside .site-paper-scope keeps its
            own coloring (used by TopDeptStrip). */}
        <style>{`
          body { background: #FFFFFF !important; }
          .site-paper-scope, .site-paper-scope * {
            --card:#FFFFFF; --border:#E6DFCC; --paper:#FFFFFF; --paper-warm:#FFFFFF;
            --paper-deep:#F5F0E1; --hairline:#E6DFCC; --ink:#1B1B1B; --ink-soft:#3A3A3A;
            --ink-mute:#5A5A5A; --ink-faint:#8A8A8A; --brass:#1F3A2E; --primary:#1F3A2E;
            --surf:#FFFFFF; --surf-0:#FFFFFF; --surf-1:#FFFFFF; --surf-2:#FAFAF7; --surf-3:#F5F0E1;
            --border-1:#E6DFCC; --border-2:#E6DFCC; --border-3:#C8C0A6;
            --text-0:#1B1B1B; --text-1:#1B1B1B; --text-2:#3A3A3A; --text-3:#5A5A5A;
            --text-dim:#5A5A5A; --text-place:#8A8A8A; --text-mute:#5A5A5A;
            --accent:#1F3A2E; --accent-2:#C79A6B;
            --bg:#FFFFFF; --bg-1:#FFFFFF; --bg-2:#FAFAF7;
            --line:rgba(27,27,27,0.14); --line-soft:rgba(27,27,27,0.08);
            --moss:#2D6A4F; --sage:#5A7A62; --brass-soft:#C79A6B; --brass-pale:#E6D4B0;
          }
          .site-paper-scope { background: #FFFFFF; }
        `}</style>
        <PropertyThemeWatcher />
        <CapacityResetOnPillarChange />
        <NDropdown />
        <GmailNavDropdown />
        <TopDeptStrip />
        <div className="site-paper-scope">
          {children}
        </div>
        <AgentEditModal />
        <BugWidget />
        <SpeedInsights />
      </body>
    </html>
  );
}
