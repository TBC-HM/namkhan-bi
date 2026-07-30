// app/holding/it2/_lib/groups.ts
// PBS 2026-07-30 — IT2: the reorganized Holding IT area (brief it-area-reorg-v1).
// Runs in parallel with /holding/it until PBS approves; then old IT retires.
//
// NAV LAWS (locked once IT2 is approved):
//   1. Max 5 groups, max 5 sub-tabs. A new page replaces or nests — never appends.
//   2. One fact = one surface. Module status lives ONLY in Modules → Status.
//   3. Every page must be reachable from this GROUPS array (no orphans).
//   4. Anything needing PBS lands on the Action Center automatically.

export type It2GroupKey = 'home' | 'modules' | 'knowledge' | 'fleet' | 'system';

interface GroupSpec {
  key: It2GroupKey;
  label: string;
  href: string;
  subs: Array<{ href: string; label: string }>;
}

export const GROUPS: GroupSpec[] = [
  { key: 'home', label: 'Action Center', href: '/holding/it2', subs: [] },
  {
    key: 'modules', label: 'Modules', href: '/holding/it2/modules/status',
    subs: [
      { href: '/holding/it2/modules/status', label: 'Status' },
      { href: '/holding/it2/modules/queue',  label: 'Work Queue' },
      { href: '/holding/it2/modules/briefs', label: 'Briefs' },
      { href: '/holding/it2/modules/specs',  label: 'Module Docs' },
      { href: '/holding/it2/modules/intake', label: '+ Intake' },
    ],
  },
  {
    key: 'knowledge', label: 'Knowledge', href: '/holding/it2/knowledge/docs',
    subs: [
      { href: '/holding/it2/knowledge/docs',       label: 'Docs' },
      { href: '/holding/it2/knowledge/goals',      label: 'Goals' },
      { href: '/holding/it2/knowledge/data',       label: 'Data' },
      { href: '/holding/it2/knowledge/design',     label: 'Design' },
      { href: '/holding/it2/knowledge/university', label: 'University' },
    ],
  },
  {
    key: 'fleet', label: 'Fleet', href: '/holding/it2/fleet/team',
    subs: [
      { href: '/holding/it2/fleet/team',   label: 'Team' },
      { href: '/holding/it2/fleet/skills', label: 'Skills' },
      { href: '/holding/it2/fleet/memory', label: 'Memory' },
      { href: '/holding/it2/fleet/chat',   label: 'Chat' },
      { href: '/holding/it2/fleet/tasks',  label: 'Tasks' },
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
