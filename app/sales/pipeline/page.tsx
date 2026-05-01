// app/sales/pipeline/page.tsx
// Sales › Pipeline — not yet wired (no sales.pipeline_stages schema).

import LoremPage, { LOREM_SHORT, LOREM_LONG } from '../_components/LoremPage';

export const dynamic = 'force-dynamic';

export default function PipelinePage() {
  return (
    <LoremPage
      pillar="Sales"
      tab="Pipeline"
      lede="Quote → booking funnel, conversion analytics, lost-reason taxonomy. Conversion Coach weekly insights."
      kpis={[
        { scope: 'Open opportunities', sub: 'across all stages' },
        { scope: 'Pipeline value',     sub: 'USD weighted' },
        { scope: 'Win rate',           sub: 'last 90 days' },
        { scope: 'Avg deal size',      sub: 'closed-won' },
        { scope: 'Cycle time',         sub: 'inquiry → close' },
      ]}
      sections={[
        { heading: 'Funnel by stage',           body: LOREM_LONG },
        { heading: 'Top open opportunities',    body: LOREM_SHORT },
        { heading: 'Lost-reason taxonomy',      body: LOREM_SHORT },
        { heading: 'Conversion Coach insights', body: LOREM_LONG },
      ]}
      dataSourceNote="Needs schema: sales.opportunities, sales.opportunity_stage_history, sales.lost_reasons. Pipeline is fed from Inquiries (existing) + Groups + FIT + B2B/DMC quote events."
    />
  );
}
