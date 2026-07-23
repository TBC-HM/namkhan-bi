// app/cockpit-v2/_lib/groups.ts
//
// PBS 2026-07-23: canonical DashboardPage tabs metadata for cockpit-v2.
// Each page imports this + marks the active tab, so the sub-strip renders
// consistently across every page.

import type { DashboardTab } from '@/app/(cockpit)/_design/types';

export type CockpitGroupKey = 'home' | 'fleet' | 'knowledge' | 'inventory' | 'ops' | 'build';

interface GroupSpec {
  key: CockpitGroupKey;
  label: string;
  href: string;
  subs: Array<{ href: string; label: string }>;
}

export const GROUPS: GroupSpec[] = [
  { key: 'home', label: 'Home', href: '/cockpit-v2', subs: [] },
  {
    key: 'fleet', label: 'Fleet', href: '/cockpit-v2/team',
    subs: [
      { href: '/cockpit-v2/team',      label: 'Team' },
      { href: '/cockpit-v2/skills',    label: 'Skills' },
      { href: '/cockpit-v2/knowledge', label: 'Memory' },
    ],
  },
  {
    key: 'knowledge', label: 'Knowledge', href: '/cockpit-v2/docs',
    subs: [
      { href: '/cockpit-v2/docs',      label: 'Docs' },
      { href: '/cockpit-v2/schemas',   label: 'Schemas' },
      { href: '/cockpit-v2/freshness', label: 'Freshness' },
    ],
  },
  { key: 'inventory', label: 'Inventory', href: '/cockpit/supabase', subs: [] },
  {
    key: 'ops', label: 'Ops', href: '/cockpit-v2/tasks',
    subs: [
      { href: '/cockpit-v2/tasks',    label: 'Tasks' },
      { href: '/cockpit-v2/activity', label: 'Activity' },
      { href: '/cockpit-v2/chat',     label: 'Chat' },
      { href: '/cockpit-v2/health',   label: 'Health' },
    ],
  },
  {
    key: 'build', label: 'Build', href: '/cockpit-v2/deploys',
    subs: [
      { href: '/cockpit-v2/deploys', label: 'Deploys' },
      { href: '/cockpit-v2/checks',  label: 'Checks' },
      { href: '/cockpit-v2/cost',    label: 'Cost' },
    ],
  },
];

/** Build the DashboardPage tabs prop from GROUPS with `activeKey` marked. */
export function groupsAsTabs(activeKey: CockpitGroupKey): DashboardTab[] {
  return GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    href: g.href,
    active: g.key === activeKey,
  }));
}
