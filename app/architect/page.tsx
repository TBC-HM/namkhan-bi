// app/architect/page.tsx — keep the dept-style architect entry reachable
// at /architect (parked here from /). The canvas at / is now the single
// surface PBS uses.
// tile-truth-wiring 2026-07-29: KPI tiles were hardcoded in DEPT_CFG.architect
// (TODO 12 · AGENTS 7 · DEPLOYS 4 · PROJECTS 3). AGENTS/DEPLOYS now come live
// from public.v_cockpit_ops_kpis; TODO/PROJECTS have no live source yet and
// render an honest '—'.

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { fetchCockpitOpsKpis, tileNum } from '@/lib/kpi/cockpitOps';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ArchitectEntry() {
  const ops = await fetchCockpitOpsKpis();
  const cfg = {
    ...DEPT_CFG.architect,
    kpiTiles: [
      { k: 'TODO',     v: '—', d: 'no live source yet' },
      { k: 'AGENTS',   v: tileNum(ops?.agents_active), d: 'active roles' },
      { k: 'DEPLOYS',  v: tileNum(ops?.deploys_24h),   d: 'last 24h' },
      { k: 'PROJECTS', v: '—', d: 'no live source yet' },
    ],
  };
  return <DeptEntry cfg={cfg} />;
}
