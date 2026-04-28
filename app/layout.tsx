// app/layout.tsx
// Root layout for Namkhan BI dashboard.
// Structure (mockup-faithful):
//   <header>     Brand name + As-of timestamp + Currency toggle
//   <TopNav>     Overview / Today / Action Plans / Revenue / Departments / Finance
//   <PeriodBar>  Look Back / Forward / Segment / Compare dropdowns
//   <main>       Page content (with optional sub-nav inside)

import type { Metadata } from 'next';
import './../styles/globals.css';
import Brand from '@/components/nav/Brand';
import TopNav from '@/components/nav/TopNav';
import PeriodBar from '@/components/nav/PeriodBar';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'The Namkhan · BI',
  description: 'Operator intelligence dashboard for The Namkhan, Luang Prabang.',
};
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <Brand />
        </header>
        <TopNav />
        <Suspense fallback={<div className="period-wrap" style={{ minHeight: 110 }} />}>
          <PeriodBar />
        </Suspense>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
