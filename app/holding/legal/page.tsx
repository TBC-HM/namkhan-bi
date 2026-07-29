// app/holding/legal/page.tsx
// PBS 2026-07-09: Legal · Holding — Carla's HoD landing on HodLanding v2.
// Was DeptEntry (chat + attn / docs / tasks). Now mirrors /revenue and /holding/finance
// (Shortcuts / My Reports / My Tasks / External Links + Conclusions).

import HodLanding from '@/app/_components/HodLanding';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { fetchLegalCasesSummary, tileNum } from '@/lib/kpi/cockpitOps';
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

export default async function HoldingLegalPage() {
  const insights = insightsFromCfg();
  // tile-truth-wiring 2026-07-29: EXPOSURE / BLEED / TARGET tiles removed
  // (no live source — brief §0.R R1). OPEN CASES is live from
  // public.v_legal_cases_summary (counts only, no case details).
  const legal = await fetchLegalCasesSummary();
  const liveTiles = [
    { label: 'OPEN CASES', value: tileNum(legal?.cases_active), size: 'sm' as const, footnote: 'active matters' },
  ];

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
