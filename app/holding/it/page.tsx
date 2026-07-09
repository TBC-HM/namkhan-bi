// app/holding/it/page.tsx
// PBS 2026-07-09 pm: Holding · IT — Kit's HoD landing on HodLanding v2.
// Was DeptEntry. Now mirrors /holding/ceo layout — headline tiles + Shortcuts /
// Reports / Tasks / Links row. Kit owns platform infra + agent fleet.

import HodLanding from '@/app/_components/HodLanding';
import { DEPT_CFG } from '@/lib/dept-cfg';
import type { Insight } from '@/app/_components/ConclusionBlock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HOLDING_PID = 0;

function insightsFromCfg(): Insight[] {
  const cfg = DEPT_CFG.holding_it;
  const attn = cfg.defaultAttn ?? [];
  return attn.map((a) => ({
    key: a.id,
    priority: a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'info',
    title: a.label,
    body: a.kind === 'leakage' ? 'Infra / platform risk — Kit to unblock.' : 'Opportunity — ship autonomous fleet output.',
  }));
}

export default function HoldingItPage() {
  const cfg = DEPT_CFG.holding_it;
  const insights = insightsFromCfg();
  const liveTiles = (cfg.kpiTiles ?? []).map((k) => ({
    label: k.k, value: k.v, size: 'sm' as const, footnote: k.d,
  }));

  return (
    <HodLanding
      slug="holding_it"
      propertyId={HOLDING_PID}
      liveTiles={liveTiles}
      settingsHref="/holding/settings"
      conclusions={{
        insights,
        title: 'CONCLUSIONS · platform · agent fleet · deploys',
        subtitle: 'IT scope · infrastructure, deploys, autonomous PRs',
        emptyText: 'Nothing waiting for IT.',
      }}
    />
  );
}
