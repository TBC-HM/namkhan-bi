// app/marketing/content/page.tsx
// PBS 2026-07-21 · Content hub — nav-only. Sub-strip renders automatically via
// NAV_SUBGROUPS lookup in DashboardPage. The old link-card grid is gone; the
// sub-strip [Products & Offers · Compiler · Campaigns · Newsletter · Media] IS the nav.
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';

export const dynamic = 'force-dynamic';

const CONTENT_SUBPAGES: { label: string; href: string }[] = [
  { label: 'Products & Offers', href: '/marketing/offers'    },
  { label: 'Compiler',          href: '/marketing/compiler'  },
  { label: 'Campaigns',         href: '/marketing/campaigns' },
  { label: 'Newsletter',        href: '/marketing/newsletter' },
  { label: 'Media',             href: '/marketing/gallery'   },
];

export default function ContentHubPage() {
  const tabs: DashboardTab[] = CONTENT_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: false,
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
