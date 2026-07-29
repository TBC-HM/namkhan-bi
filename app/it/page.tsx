// app/it/page.tsx
// tile-truth-wiring 2026-07-29: KPI tiles were hardcoded in DEPT_CFG.it
// (TICKETS 8 · AGENTS 7/9 · SLA 94% · DEPLOYS 12). This page is now a server
// component that fetches public.v_cockpit_ops_kpis and passes live values
// into the client DeptEntry via a cfg override. '—' on fetch failure.

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { fetchCockpitOpsKpis, tileDeploys, tileNum, tilePct } from '@/lib/kpi/cockpitOps';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ITPage() {
  const ops = await fetchCockpitOpsKpis();
  const deploys = tileDeploys(ops); // '—' + 'deploy feed offline' while the feed is dead
  const cfg = {
    ...DEPT_CFG.it,
    kpiTiles: [
      {
        k: 'TICKETS', v: tileNum(ops?.tickets_open),
        d: ops ? `open · ${ops.tickets_awaits_user} awaits-user` : 'open',
      },
      { k: 'AGENTS',  v: tileNum(ops?.agents_active), d: 'active roles' },
      { k: 'SLA',     v: tilePct(ops?.sla_triage_pct), d: '30d · first action ≤5 min' },
      { k: 'DEPLOYS', v: deploys.value,   d: deploys.footnote },
    ],
  };
  return <DeptEntry cfg={cfg} />;
}
