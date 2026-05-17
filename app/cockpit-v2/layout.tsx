// app/cockpit-v2/layout.tsx
//
// PBS 2026-05-17: cockpit-v2 nav rebuilt — 14 flat tabs → 9 grouped tabs.
// Click ➜ debug-drawer pattern adopted on /team. New routes /checks and
// /freshness surfaced. Beyond Circle palette (peach + teal on navy) via
// tokens.ts. This is the holding-level fleet-management surface.

import { fetchAgents, fetchDocs, fetchMemories } from './_lib/data';
import { fetchOpenTaskCount, fetchUnseenNotifyCount } from './_lib/data-port';
import { TabBar } from './_components/TabBar';
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

  // PBS 2026-05-17 9-tab structure. Each tab = one operational concern.
  // Routes that already exist (chat, notify, users, tasks, platform-map)
  // are reachable via direct URLs and the /home More menu.
  const tabs = [
    { href: '/cockpit-v2',           label: 'Home',         n: null },
    { href: '/cockpit-v2/team',      label: 'Team',         n: agents.length },
    { href: '/cockpit-v2/docs',      label: 'Docs',         n: docs.length },
    { href: '/cockpit-v2/knowledge', label: 'Memory',       n: memories.length },
    { href: '/cockpit-v2/schemas',   label: 'Schemas',      n: null },
    { href: '/cockpit-v2/freshness', label: 'Freshness',    n: null },
    { href: '/cockpit-v2/checks',    label: 'Checks',       n: null },
    { href: '/cockpit-v2/activity',  label: 'Activity',     n: null },
    { href: '/cockpit-v2/deploys',   label: 'Deploys',      n: null },
    { href: '/cockpit-v2/cost',      label: 'Cost',         n: null },
    // utility (kept reachable, but slimmed):
    { href: '/cockpit-v2/tasks',     label: 'Tasks',        n: openTasks },
    { href: '/cockpit-v2/chat',      label: 'Chat',         n: null },
    { href: '/cockpit-v2/health',    label: 'Health',       n: unseenNotify > 0 ? unseenNotify : null },
    { href: '/tbc',                  label: 'BC ↗',         n: null },
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
        <TabBar tabs={tabs} />
        <main style={{ padding: '28px 32px', maxWidth: 1600, margin: '0 auto' }}>{children}</main>
      </div>
    </Page>
  );
}
