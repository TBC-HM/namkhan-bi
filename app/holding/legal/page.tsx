// app/holding/legal/page.tsx
// PBS 2026-07-09: Legal · Holding — Carla's HoD landing on HodLanding v2.
// Was DeptEntry (chat + attn / docs / tasks). Now mirrors /revenue and /holding/finance
// (Shortcuts / My Reports / My Tasks / External Links + Conclusions).

import HodLanding from '@/app/_components/HodLanding';
import { DEPT_CFG } from '@/lib/dept-cfg';
import type { Insight } from '@/app/_components/ConclusionBlock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HOLDING_PID = 0;

function insightsFromCfg(): Insight[] {
  const cfg = DEPT_CFG.holding_legal;
  const attn = cfg.defaultAttn ?? [];
  return attn.map((a) => ({
    key: a.id,
    priority: a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'info',
    title: a.label,
    body: a.kind === 'leakage' ? 'Open action · leakage / risk track.' : 'Open action · opportunity track.',
  }));
}

export default function HoldingLegalPage() {
  const cfg = DEPT_CFG.holding_legal;
  const insights = insightsFromCfg();
  const liveTiles = (cfg.kpiTiles ?? []).map((k) => ({
    label: k.k, value: k.v, size: 'sm' as const, footnote: k.d,
  }));

  return (
    <HodLanding
      slug="holding_legal"
      propertyId={HOLDING_PID}
      liveTiles={liveTiles}
      settingsHref="/holding/settings"
      conclusions={{
        insights,
        title: 'CONCLUSIONS · cases · exposure · settlements',
        subtitle: 'Holding legal scope · Beyond Circle + delegated OpCo matters',
        emptyText: 'No open legal alarms.',
      }}
    />
  );
}
