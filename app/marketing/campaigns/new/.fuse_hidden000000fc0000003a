// app/marketing/campaigns/new/page.tsx
// Brand & Marketing · New campaign — 5-step wizard.

import PanelHero from '@/components/sections/PanelHero';
import CampaignWizard from '@/components/marketing/CampaignWizard';
import { getCampaignTemplates, getMediaReady } from '@/lib/marketing';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const [templates, assetPool] = await Promise.all([
    getCampaignTemplates(),
    getMediaReady({ limit: 60 }),
  ]);

  return (
    <>
      <PanelHero
        eyebrow="Brand · Marketing · campaigns · new"
        title="Build"
        emphasis="campaign"
        sub="Brief → Curate → Compose → Approve → Distribute · 5 steps · ~4 minutes"
      />
      <CampaignWizard templates={templates} assetPool={assetPool} />
    </>
  );
}
