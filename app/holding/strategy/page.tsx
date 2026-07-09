// app/holding/strategy/page.tsx
// PBS 2026-07-09: Strategy · Holding — Fox's HoD landing on HodLanding v2.
// Was DeptEntry. Now mirrors /revenue and /holding/finance layout.

import HodLanding from '@/app/_components/HodLanding';
import { DEPT_CFG } from '@/lib/dept-cfg';
import type { Insight } from '@/app/_components/ConclusionBlock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HOLDING_PID = 0;

function insightsFromCfg(): Insight[] {
  const cfg = DEPT_CFG.holding_strategy;
  const attn = cfg.defaultAttn ?? [];
  return attn.map((a) => ({
    key: a.id,
    priority: a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'info',
    title: a.label,
    body: a.kind === 'leakage' ? 'Structural risk — plan a mitigation.' : 'Opportunity for group-level move.',
  }));
}

export default function HoldingStrategyPage() {
  const cfg = DEPT_CFG.holding_strategy;
  const insights = insightsFromCfg();
  const liveTiles = (cfg.kpiTiles ?? []).map((k) => ({
    label: k.k, value: k.v, size: 'sm' as const, footnote: k.d,
  }));

  return (
    <HodLanding
      slug="holding_strategy"
      propertyId={HOLDING_PID}
      liveTiles={liveTiles}
      settingsHref="/holding/settings"
      conclusions={{
        insights,
        title: 'CONCLUSIONS · group structure · contracts · cash-flow',
        subtitle: 'Strategy scope · OpCo/PropCo · management + lease + intercompany',
        emptyText: 'No structural alarms right now.',
      }}
    />
  );
}
