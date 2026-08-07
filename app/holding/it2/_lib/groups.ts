// app/holding/it2/_lib/groups.ts
// FINAL PERMANENT NAV — PBS approved 2026-08-02.
// 2026-08-03 — Settings removed from System subs; gear lives in top bar now.

export type It2GroupKey = 'home' | 'knowledge' | 'agents' | 'build' | 'system';

interface GroupSpec {
  key: It2GroupKey;
  label: string;
  href: string;
  subs: Array<{ href: string; label: string }>;
}

export const GROUPS: GroupSpec[] = [
  {
    key: 'home', label: 'Action Center', href: '/holding/it2',
    subs: [
      { href: '/holding/it2/fleet/bugs',   label: 'Bugs' },
      { href: '/holding/it2/system/live',  label: '⬤ Live' },
    ],
  },
  {
    key: 'knowledge', label: 'Knowledge', href: '/holding/it2/knowledge/docs',
    subs: [
      { href: '/holding/it2/knowledge/docs',       label: 'Docs' },
      { href: '/holding/it2/knowledge/goals',      label: 'Goals' },
      { href: '/holding/it2/fleet/skills',         label: 'Skills' },
      { href: '/holding/it2/fleet/memory',         label: 'Memory' },
      { href: '/holding/it2/knowledge/design',     label: 'Design' },
      { href: '/holding/it2/knowledge/university', label: 'University' },
      { href: '/holding/it2/knowledge/data',       label: 'Data' },
    ],
  },
  {
    key: 'agents', label: 'Agents', href: '/holding/it2/fleet/team',
    // loops-audit-v1 (2026-08-07): Agents was the only group with no sub-tabs.
    // Loops & Chains and Cron jobs are different DATASETS, not further views of
    // the 112-agent fleet, so they get URLs rather than living behind the
    // Agents-&-pillars / Org-chart toggle (that toggle stays in-page, unchanged).
    // 3 subs — law 659 cap is 5.
    subs: [
      { href: '/holding/it2/fleet/team',  label: 'Team' },
      { href: '/holding/it2/fleet/loops', label: 'Loops & Chains' },
      { href: '/holding/it2/fleet/cron',  label: 'Cron jobs' },
    ],
  },
  {
    key: 'build', label: 'Build', href: '/holding/it2/modules/status',
    subs: [
      { href: '/holding/it2/modules/status', label: 'Status' },
      { href: '/holding/it2/modules/specs',  label: 'Specs' },
      { href: '/holding/it2/modules/queue',  label: 'Queue' },
      { href: '/holding/it2/modules/intake', label: '+ Intake' },
      // Briefs DEMOTED from owner nav (module-surface-consolidation-v1 scope 2,
      // 2026-08-06): raw fleet work-log, not an owner surface. Reachable via
      // System → Health link card (law-659 pattern) + orphan-check allowlist.
      // Queue STAYS: PBS-ordered later (modules-queue-eta-v1, 2026-08-04).
    ],
  },
  {
    key: 'system', label: 'System', href: '/holding/it2/system/deploys',
    subs: [
      { href: '/holding/it2/system/deploys',   label: 'Deploys' },
      { href: '/holding/it2/system/checks',    label: 'Checks' },
      { href: '/holding/it2/system/health',    label: 'Health' },
      { href: '/holding/it2/system/activity',  label: 'Activity' },
      // Finding #70 (2026-08-05): legacy it2 cost page retired — cost_usd_milli
      // path superseded by costs.* (ADR-196). ONE cost surface: finance costs v2.
      { href: '/holding/finance/costs',        label: 'Cost' },
      { href: '/holding/it2/system/recovery',  label: 'Recovery' },
      // ADR-230: the global stop. Was SQL-only until 2026-08-05.
      { href: '/holding/it2/system/automation', label: '⏻ Automation' },
    ],
  },
];
