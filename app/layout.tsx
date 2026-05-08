// app/layout.tsx
// 2026-05-08 redesign — green frame REMOVED per PBS directive.
// Old: LeftRail + main column with green PILLAR header + horizontal tabs.
// New: edge-to-edge content; navigation handled by floating <NDropdown />
// (top-left brass N badge, click → dept menu) on every page.

import type { Metadata } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './../styles/globals.css';
import NDropdown from '@/components/nav/NDropdown';
import CapacityResetOnPillarChange from '@/components/nav/CapacityResetOnPillarChange';
import AgentEditModal from '@/components/agents/AgentEditModal';

export const metadata: Metadata = {
  title: 'The Namkhan · BI',
  description: 'Operator intelligence dashboard for The Namkhan, Luang Prabang.',
};
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CapacityResetOnPillarChange />
        <NDropdown />
        {children}
        <AgentEditModal />
        <SpeedInsights />
      </body>
    </html>
  );
}
