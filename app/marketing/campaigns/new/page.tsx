// app/marketing/campaigns/new/page.tsx
// PBS 2026-07-21: Migrated from PanelHero to DashboardPage (design v6/v7).
// Paper white + hairlines. Preserves 5-step CampaignWizard.

import {
  DashboardPage,
  type DashboardTab,
} from '@/app/(cockpit)/_design';
import CampaignWizard from '@/components/marketing/CampaignWizard';
import { getCampaignTemplates, getMediaReady } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';

const WHITE = '#FFFFFF';

export default async function NewCampaignPage() {
  const [templates, assetPool] = await Promise.all([
    getCampaignTemplates(),
    getMediaReady({ limit: 60 }),
  ]);

  // Mark /marketing/campaigns as active — /new is its child.
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/campaigns',
  }));

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · New campaign"
        subtitle="Brief → Curate → Compose → Approve → Distribute · 5 steps · ~4 minutes"
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <CampaignWizard templates={templates} assetPool={assetPool} />
        </div>
      </DashboardPage>
    </div>
  );
}
