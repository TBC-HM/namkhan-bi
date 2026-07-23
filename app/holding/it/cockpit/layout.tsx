// app/holding/it/cockpit/layout.tsx
//
// PBS 2026-07-23 (6th pass): drop the Page shell entirely. It was rendering
// its own eyebrow ("COCKPIT · V2") + HeaderPills strip, and DashboardPage
// (used by each page inside) renders its OWN sticky top with the same
// HeaderPills — so pills appeared twice + an empty dark band sat between.
//
// Global BC/CEO/Revenue/… top nav lives ABOVE the Page shell in the app
// layout, so removing Page doesn't remove that. What we get: pure white body,
// canonical DashboardPage owns the header, one FX pills row, no eyebrow.

import '@/app/(cockpit)/_design/internal/tokens.css';

export const dynamic = 'force-dynamic';

export default function CockpitV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cockpit-design" style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      {children}
    </div>
  );
}
