// app/cockpit-v2/layout.tsx
//
// 5+1 grouped top tabs. 2026-05-19: Inventory promoted to a top-level group
// (was buried as a Knowledge subitem — invisible until Knowledge clicked).
// Inventory has no subs — clicking it goes straight to /cockpit/supabase
// (middleware redirects to /h/260955/cockpit/supabase).

import { fetchAgents, fetchDocs, fetchMemories } from './_lib/data';
import { fetchOpenTaskCount, fetchUnseenNotifyCount } from './_lib/data-port';
import { GroupedTabBar, type Group } from './_components/GroupedTabBar';
import Page from '@/components/page/Page';

export const dynamic = 'force-dynamic';

export default async function CockpitV2Layout({ children }: { children: React.ReactNode }) {
  const [agents, docs, memories, openTasks, unseenNotify] = await Promise.all([
    fetchAgents(),
    fetchDocs(),
    fetchMemories(),
    fetchOpenTaskCount(),
    fetchUnseenNotifyCount(),
  ]);

  const groups: Group[] = [
    { key: 'home', label: 'Home', href: '/cockpit-v2', subs: [] },
    {
      key: 'fleet', label: 'Fleet', href: '/cockpit-v2/team',
      subs: [
        { href: '/cockpit-v2/team',     label: 'Team',    n: agents.length },
        { href: '/cockpit-v2/skills',   label: 'Skills',  n: null },
        { href: '/cockpit-v2/knowledge',label: 'Memory',  n: memories.length },
      ],
    },
    {
      key: 'knowledge', label: 'Knowledge', href: '/cockpit-v2/docs',
      subs: [
        { href: '/cockpit-v2/docs',      label: 'Docs',      n: docs.length },
        { href: '/cockpit-v2/schemas',   label: 'Schemas',   n: null },
        { href: '/cockpit-v2/freshness', label: 'Freshness', n: null },
      ],
    },
    {
      key: 'inventory', label: 'Inventory', href: '/cockpit/supabase',
      subs: [],
    },
    {
      key: 'ops', label: 'Ops', href: '/cockpit-v2/tasks',
      subs: [
        { href: '/cockpit-v2/tasks',    label: 'Tasks',    n: openTasks },
        { href: '/cockpit-v2/activity', label: 'Activity', n: null },
        { href: '/cockpit-v2/chat',     label: 'Chat',     n: null },
        { href: '/cockpit-v2/health',   label: 'Health',   n: unseenNotify > 0 ? unseenNotify : null },
      ],
    },
    {
      key: 'build', label: 'Build', href: '/cockpit-v2/deploys',
      subs: [
        { href: '/cockpit-v2/deploys', label: 'Deploys', n: null },
        { href: '/cockpit-v2/checks',  label: 'Checks',  n: null },
        { href: '/cockpit-v2/cost',    label: 'Cost',    n: null },
      ],
    },
  ];

  return (
    <Page
      eyebrow="cockpit · v2"
      title={<em>Multi-tenant fleet control</em>}
      kpiTiles={[
        { k: 'AGENTS', v: String(agents.length), d: 'identities' },
        { k: 'DOCS',   v: String(docs.length),   d: 'live published' },
        { k: 'MEMORY', v: String(memories.length), d: 'active rows' },
      ]}
    >
      <style>{`
        @keyframes cockpitv2blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>
      <div style={{ fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
        <GroupedTabBar groups={groups} />
        <main style={{ padding: '28px 32px', maxWidth: 1600, margin: '0 auto' }}>{children}</main>
      </div>
    </Page>
  );
}
