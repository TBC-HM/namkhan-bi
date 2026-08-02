// app/holding/it2/_lib/groups.ts
// FINAL PERMANENT NAV — PBS approved 2026-08-02.
// NAV LAWS (locked):
//   1. Max 5 groups. Sub-tabs: Knowledge has 7 (horizontal scroll — all pages must stay in ALLOWLIST).
//   2. One fact = one surface. No duplicates.
//   3. Every IT2 page.tsx must be reachable from this array (orphan checker enforces this).
//   4. Chat removed from IT2: exists in CEO/Sales/Marketing front nav.
//   5. Fleet retired: Tasks→Action Center, Skills/Memory→Knowledge, Team→Agents.

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
      { href: '/holding/it2/fleet/tasks', label: 'Tasks' },
    ],
  },
  {
    // Knowledge: all docs, goals, skills, memory + design/university/data must stay in ALLOWLIST
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
    // Agents: team roster only. Chat removed (front nav). Tasks in Action Center.
    key: 'agents', label: 'Agents', href: '/holding/it2/fleet/team',
    subs: [],
  },
  {
    // Build: renamed from Modules. Same content.
    key: 'build', label: 'Build', href: '/holding/it2/modules/status',
    subs: [
      { href: '/holding/it2/modules/status', label: 'Status' },
      { href: '/holding/it2/modules/briefs', label: 'Briefs' },
      { href: '/holding/it2/modules/specs',  label: 'Specs' },
      { href: '/holding/it2/modules/queue',  label: 'Queue' },
      { href: '/holding/it2/modules/intake', label: '+ Intake' },
    ],
  },
  {
    key: 'system', label: 'System', href: '/holding/it2/system/deploys',
    subs: [
      { href: '/holding/it2/system/deploys',  label: 'Deploys' },
      { href: '/holding/it2/system/checks',   label: 'Checks' },
      { href: '/holding/it2/system/health',   label: 'Health' },
      { href: '/holding/it2/system/activity', label: 'Activity' },
      { href: '/holding/it2/system/cost',     label: 'Cost' },
    ],
  },
];
