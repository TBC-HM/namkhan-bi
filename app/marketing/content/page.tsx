// app/marketing/content/page.tsx
// PBS 2026-07-21 · Content hub — nav-only. Sub-strip renders automatically via
// NAV_SUBGROUPS lookup in DashboardPage. The old link-card grid is gone; the
// sub-strip [Products & Offers · Compiler · Campaigns · Newsletter · Media] IS the nav.
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';

export default function ContentHubPage() {
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/content',
  }));
  return (
    <DashboardPage
      title="Marketing · Content"
      subtitle="Products & Offers, Compiler, Campaigns, Newsletter, Media — everything you produce and send."
      tabs={tabs}
    >
      <></>
    </DashboardPage>
  );
}
