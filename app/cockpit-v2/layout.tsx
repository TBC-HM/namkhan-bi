// app/cockpit-v2/layout.tsx
//
// PBS 2026-07-23 (5th pass — canonical match with /holding/it):
// Kill the giant Fraunces italic title from Page shell.
// Kill the bespoke GroupedTabBar (chunky serif tabs with fat gold underline).
// Each page inside cockpit-v2 now uses <DashboardPage title=... tabs=...>
// which renders the canonical sticky-top pattern (thin sans-serif tabs,
// sand underline on active, action slot on right).
//
// The 6 groups (Home / Fleet / Knowledge / Inventory / Ops / Build) become
// the `tabs` prop passed by each page. The current-group's sub-tabs get
// registered via nav-subgroups (or passed inline if simpler).

import { GROUPS } from './_lib/groups';
import Page from '@/components/page/Page';
import '@/app/(cockpit)/_design/internal/tokens.css';

export const dynamic = 'force-dynamic';

// Groups metadata is now co-located with _lib so pages can import + build
// their own DashboardPage tabs prop. See _lib/groups.ts.
export { GROUPS };

export default function CockpitV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <Page
      /* No `title` — DashboardPage on each page renders the real title. */
      eyebrow="cockpit · v2"
      hideWeather={false}
    >
      {/* Canonical .cockpit-design scope + cream body per tokens.css --bg. */}
      <div className="cockpit-design" style={{ minHeight: '100vh' }}>
        {children}
      </div>
    </Page>
  );
}
