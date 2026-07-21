// app/marketing/digital/page.tsx
// PBS 2026-07-21 · Digital hub — nav-only. Sub-strip renders automatically via
// NAV_SUBGROUPS lookup in DashboardPage. The old link-card grid is gone; the
// sub-strip [Web · Funnels · SEO] IS the nav. Digital is a child of Channels,
// so the top strip highlights Channels while the sub-strip surfaces Digital's children.
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';

export default function DigitalHubPage() {
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/channels', // Digital sits under Channels
  }));
  return (
    <DashboardPage
      title="Marketing · Digital"
      subtitle="Web, Funnels, SEO — the acquisition surface."
      tabs={tabs}
    >
      <></>
    </DashboardPage>
  );
}
