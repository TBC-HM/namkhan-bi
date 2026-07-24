// app/holding/it/cockpit/layout.tsx
// PBS 2026-07-24 (7th pass): add CockpitGroupNav client component that
// renders group tabs + sub-strip on every cockpit page — including legacy
// pages (Deploys, Tasks, etc.) that don't use DashboardPage.
// "Build → + New spec" is now always visible from any cockpit page.

import '@/app/(cockpit)/_design/internal/tokens.css';
import CockpitGroupNav from './_components/CockpitGroupNav';

export const dynamic = 'force-dynamic';

export default function CockpitV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cockpit-design" style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <CockpitGroupNav />
      <div style={{ padding: '20px 24px' }}>
        {children}
      </div>
    </div>
  );
}
