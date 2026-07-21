// app/marketing/channels/page.tsx
// PBS 2026-07-21 · Channels hub — nav-only. Sub-strip renders automatically via
// NAV_SUBGROUPS lookup in DashboardPage. The old link-card grid is gone; the
// sub-strip [Socials · YouTube · Digital] IS the nav.
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';

export default function ChannelsHubPage() {
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/channels',
  }));
  return (
    <DashboardPage
      title="Marketing · Channels"
      subtitle="Socials, YouTube, Digital — where you publish and distribute."
      tabs={tabs}
    >
      {/* Empty body — sub-strip is the nav. */}
    </DashboardPage>
  );
}
