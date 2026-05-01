// app/layout.tsx
// Beyond Circle shell: left rail + main column.
// Each page renders its own <Banner>, <SubNav>, <FilterStrip>, <main className="panel">.

import type { Metadata } from 'next';
import './../styles/globals.css';
import LeftRail from '@/components/nav/LeftRail';
import CapacityResetOnPillarChange from '@/components/nav/CapacityResetOnPillarChange';

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
        <div className="shell">
          <LeftRail />
          <div className="main">{children}</div>
        </div>
      </body>
    </html>
  );
}
