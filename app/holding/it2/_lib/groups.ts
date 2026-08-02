// app/holding/it2/_lib/groups.ts
// FINAL PERMANENT NAV — PBS approved 2026-08-02.
// NAV LAWS (locked):
//   1. Max 5 groups, max 5 sub-tabs. New pages replace or nest — never append.
//   2. One fact = one surface. No duplicates across groups.
//   3. Every page reachable from this array (no orphans).
//   4. Chat removed: exists in CEO/Sales/Marketing front nav.
//   5. Fleet retired: Tasks → Action Center, Skills/Memory → Knowledge, Team → Agents.

export type It2GroupKey = 'home' | 'knowledge' | 'agents' | 'build' | 'system';

interface GroupSpec {
  key: It2GroupKey;
  label: string;
  href: string;
  subs: Array<{ href: string; label: string }>;
}

export const GROUPS: GroupSpec[] = [
  {
    // Action Center: what needs PBS attention. Tasks + Bugs surface here.
    key: 'home', label: 'Action Center', href: '/holding/it2',
    subs: [
      { href: '/holding/it2/fleet/tasks',  label: 'Tasks' },
      // Bugs sub added when /holding/it2/bugs page is built
    ],
  },
  {
    // Knowledge: everything the platform knows and can do.
    // Skills + Memory moved here from Fleet (physical paths unchanged).
    // University + Data accessible from Docs page (5-tab limit enforced).
    key: 'knowledge', label: 'Knowledge', href: '/holding/it2/knowledge/docs',
    subs: [
      { href: '/holding/it2/knowledge/docs',    label: 'Docs' },
      { href: '/holding/it2/knowledge/goals',   label: 'Goals' },
      { href: '/holding/it2/fleet/skills',      label: 'Skills' },
      { href: '/holding/it2/fleet/memory',      label: 'Memory' },
      { href: '/holding/it2/knowledge/design',  label: 'Design' },
    ],
  },
  {
    // Agents: who does things. Team roster only.
    // Chat removed (front nav). Tasks moved to Action Center.
    // No sub-strip — direct link to team page.
    key: 'agents', label: 'Agents', href: '/holding/it2/fleet/team',
    subs: [],
  },
  {
    // Build: spec new features, manage briefs, queue, intake.
    // Renamed from Modules — better describes the content.
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
    // System: platform health and operations. Unchanged.
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
