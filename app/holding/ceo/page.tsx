// app/holding/ceo/page.tsx
// PBS 2026-07-09: CEO · Holding — Felix's HoD landing on HodLanding v2.
// Was DeptEntry. Now mirrors /revenue and /holding/finance layout with
// portfolio-level headline tiles and a Shortcuts / My Reports / My Tasks / Links row.

import HodLanding from '@/app/_components/HodLanding';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { fetchCockpitOpsKpis, tileNum } from '@/lib/kpi/cockpitOps';
import type { Insight } from '@/app/_components/ConclusionBlock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HOLDING_PID = 0;

function insightsFromCfg(): Insight[] {
  const cfg = DEPT_CFG.holding_ceo;
  const attn = cfg.defaultAttn ?? [];
  return attn.map((a) => ({
    key: a.id,
    priority: a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'info',
    title: a.label,
    body: a.kind === 'leakage' ? 'Leakage / risk — decide direction.' : 'Opportunity — approve or delegate.',
  }));
}

export default async function HoldingCeoPage() {
  const insights = insightsFromCfg();
  // tile-truth-wiring 2026-07-29: EXPOSURE tile removed (no live source —
  // brief §0.R R1); APPROVALS now live from public.v_cockpit_ops_kpis
  // (awaits-user tickets). PROPERTIES is a structural fact; PORTFOLIO stays
  // '—' until a consolidated-revenue source exists.
  const ops = await fetchCockpitOpsKpis();
  const liveTiles = [
    { label: 'PROPERTIES', value: tileNum(ops?.properties_count ?? 2), size: 'sm' as const, footnote: 'Namkhan · Donna' },
    { label: 'PORTFOLIO',  value: '—', size: 'sm' as const, footnote: 'consolidated revenue YTD' },
    { label: 'APPROVALS',  value: tileNum(ops?.tickets_awaits_user), size: 'sm' as const, footnote: 'tickets awaiting your call' },
  ];

  return (
    <HodLanding
      slug="holding_ceo"
      propertyId={HOLDING_PID}
      liveTiles={liveTiles}
      settingsHref="/holding/settings"
      conclusions={{
        insights,
        title: 'CONCLUSIONS · portfolio · approvals · board',
        subtitle: 'CEO scope · cross-property command · capital + strategy signals',
        emptyText: 'Nothing waiting for your call.',
      }}
    />
  );
}
