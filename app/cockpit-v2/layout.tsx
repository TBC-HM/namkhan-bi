// app/cockpit-v2/layout.tsx
// Persistent shell for the cockpit-v2 tab segments. Renders Page header +
// tab bar; each segment renders below as its own server component.
//
// Tab counts are computed once per request in this layout (server) so each
// tab page is not forced to do the same head-counts.
//
// 2026-05-13 #58 — IT-team agent ported the TOP 7 V1 cockpit features:
//   tasks, chat, notify, users, health, deploys, cost — appended after
//   the existing 7 tabs (Team, Knowledge, Docs, Schemas, Activity,
//   Platform-map, TBC).

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

  const tabs = [
    { href: '/cockpit-v2/team', label: 'Team', n: agents.length },
    { href: '/cockpit-v2/knowledge', label: 'Knowledge', n: memories.length },
    { href: '/cockpit-v2/docs', label: 'Docs', n: docs.length },
    { href: '/cockpit-v2/schemas', label: 'Schemas', n: null },
    { href: '/cockpit-v2/activity', label: 'Activity', n: null },
    { href: '/cockpit-v2/platform-map', label: 'Platform map', n: null },
    { href: '/tbc', label: 'Beyond Circle ↗', n: null },
    // Ported V1 cockpit features (#58)
    { href: '/cockpit-v2/tasks', label: 'Tasks', n: openTasks },
    { href: '/cockpit-v2/chat', label: 'Chat', n: null },
    { href: '/cockpit-v2/notify', label: 'Notify', n: unseenNotify },
    { href: '/cockpit-v2/users', label: 'Users', n: null },
    { href: '/cockpit-v2/health', label: 'Health', n: null },
    { href: '/cockpit-v2/deploys', label: 'Deploys', n: null },
    { href: '/cockpit-v2/cost', label: 'Cost', n: null },
  ];

  return (
    <Page
      eyebrow="cockpit · v2"
      title={<em>What&apos;s in the system right now?</em>}
      kpiTiles={[
        { k: 'AGENTS', v: String(agents.length), d: 'identities' },
        { k: 'DOCS', v: String(docs.length), d: 'live published' },
        { k: 'MEMORY', v: String(memories.length), d: 'active rows' },
      ]}
    >
      <style>{`
        @keyframes cockpitv2blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
      `}</style>
      <div style={{ fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
        <TabBar tabs={tabs} />
        <main style={{ padding: '28px 32px', maxWidth: 1600, margin: '0 auto' }}>{children}</main>
      </div>
    </Page>
  );
}
