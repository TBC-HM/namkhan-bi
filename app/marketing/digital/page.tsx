// app/marketing/digital/page.tsx
// PBS 2026-07-21 · Digital hub — nav-only. Sub-strip renders automatically via
// the tabs prop passed to DashboardPage. Digital is a child of Marketing,
// so the top strip highlights Digital while the sub-strip surfaces Digital's children.
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';

export const dynamic = 'force-dynamic';

const DIGITAL_SUBPAGES: { label: string; href: string }[] = [
  { label: 'Web',     href: '/marketing/digital/web'     },
  { label: 'Funnels', href: '/marketing/digital/funnels' },
  { label: 'YouTube', href: '/marketing/digital/youtube' },
];

export default function DigitalHubPage() {
  const tabs: DashboardTab[] = DIGITAL_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: false,
  }));
  return (
    <DashboardPage
      title="Marketing · Digital"
      subtitle="Web, Funnels, YouTube — the acquisition surface."
      tabs={tabs}
    >
      <></>
    </DashboardPage>
  );
}
