// app/holding/it/cockpit/_lib/groups.ts
//
// PBS 2026-07-23: canonical DashboardPage tabs metadata for cockpit.
// PBS 2026-07-24 v2: Build group — added Module Docs sub-tab before + New spec.

import type { DashboardTab } from '@/app/(cockpit)/_design/types';

export type CockpitGroupKey = 'home' | 'fleet' | 'knowledge' | 'inventory' | 'ops' | 'build';

interface GroupSpec {
  key: CockpitGroupKey;
  label: string;
  href: string;
  subs: Array<{ href: string; label: string }>;
}

export const GROUPS: GroupSpec[] = [
  { key: 'home', label: 'Home', href: '/holding/it/cockpit', subs: [] },
  {
    key: 'fleet', label: 'Fleet', href: '/holding/it/cockpit/team',
    subs: [
      { href: '/holding/it/cockpit/team',      label: 'Team' },
      { href: '/holding/it/cockpit/skills',    label: 'Skills' },
      { href: '/holding/it/cockpit/knowledge', label: 'Memory' },
    ],
  },
  {
    key: 'knowledge', label: 'Knowledge', href: '/holding/it/cockpit/docs',
    subs: [
      { href: '/holding/it/cockpit/docs',      label: 'Docs' },
      { href: '/holding/it/cockpit/schemas',   label: 'Schemas' },
      { href: '/holding/it/cockpit/freshness', label: 'Freshness' },
    ],
  },
  { key: 'inventory', label: 'Inventory', href: '/cockpit/supabase', subs: [] },
  {
    key: 'ops', label: 'Ops', href: '/holding/it/cockpit/tasks',
    subs: [
      { href: '/holding/it/cockpit/tasks',    label: 'Tasks' },
      { href: '/holding/it/cockpit/activity', label: 'Activity' },
      { href: '/holding/it/cockpit/chat',     label: 'Chat' },
      { href: '/holding/it/cockpit/health',   label: 'Health' },
    ],
  },
  {
    key: 'build', label: 'Build', href: '/holding/it/cockpit/deploys',
    subs: [
      { href: '/holding/it/cockpit/deploys',    label: 'Deploys' },
      { href: '/holding/it/cockpit/checks',     label: 'Checks' },
      { href: '/holding/it/cockpit/cost',       label: 'Cost' },
      { href: '/holding/it/cockpit/specs',      label: 'Module Docs' },
      { href: '/holding/it/cockpit/specs/new',  label: '+ New spec' },
    ],
  },
];

export function groupsAsTabs(activeKey: CockpitGroupKey): DashboardTab[] {
  return GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    href: g.href,
    active: g.key === activeKey,
  }));
}
