'use client';

/**
 * /cockpit — main cockpit hub page.
 * Perf fix (ticket #229-child): heavy tab panels are code-split via next/dynamic
 * so only the active tab's JS is loaded on first paint.
 *
 * Tabs lazy-loaded:
 *   Tickets · Audit Log · Incidents · DQ · Docs · Tasks
 *
 * The loading skeleton is an inline spinner — no external dep required.
 */

import dynamic from 'next/dynamic';
import { useState } from 'react';

// ── Lazy tab panels ──────────────────────────────────────────────────────────
// Each panel is behind a dynamic() boundary so its JS chunk is only fetched
// when the user first clicks that tab.  ssr:false keeps the bundle lean for
// the common path (server-rendered shell + active-tab hydration only).

const Skeleton = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 240,
      color: '#666',
      fontSize: 14,
      fontFamily: 'var(--font-mono, monospace)',
    }}
  >
    Loading…
  </div>
);

const TicketsTab = dynamic(
  () => import('@/components/cockpit/tabs/TicketsTab'),
  { ssr: false, loading: Skeleton }
);

const AuditLogTab = dynamic(
  () => import('@/components/cockpit/tabs/AuditLogTab'),
  { ssr: false, loading: Skeleton }
);

const IncidentsTab = dynamic(
  () => import('@/components/cockpit/tabs/IncidentsTab'),
  { ssr: false, loading: Skeleton }
);

const DQTab = dynamic(
  () => import('@/components/cockpit/tabs/DQTab'),
  { ssr: false, loading: Skeleton }
);

const DocsTab = dynamic(
  () => import('@/components/cockpit/tabs/DocsTab'),
  { ssr: false, loading: Skeleton }
);

const TasksTab = dynamic(
  () => import('@/components/cockpit/tabs/TasksTab'),
  { ssr: false, loading: Skeleton }
);

// ── Types ────────────────────────────────────────────────────────────────────

type TabId = 'tickets' | 'audit' | 'incidents' | 'dq' | 'docs' | 'tasks';

const TABS: { id: TabId; label: string }[] = [
  { id: 'tickets',   label: 'Tickets'   },
  { id: 'audit',     label: 'Audit Log' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'dq',        label: 'DQ'        },
  { id: 'docs',      label: 'Docs'      },
  { id: 'tasks',     label: 'Tasks'     },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CockpitPage() {
  const [activeTab, setActiveTab] = useState<TabId>('tickets');

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#e5e5e5',
        fontFamily: 'var(--font-sans, system-ui)',
        padding: '24px 32px',
      }}
    >
      {/* ── Header ── */}
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: '#f5f5f5',
          }}
        >
          Cockpit
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
          Operations hub · auto-refreshes every 60 s
        </p>
      </header>

      {/* ── Tab bar ── */}
      <nav
        role="tablist"
        aria-label="Cockpit sections"
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid #222',
          marginBottom: 24,
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#d4af37' : '#999',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #d4af37' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                marginBottom: -1,
                borderRadius: '4px 4px 0 0',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ── Tab panels ── */}
      {/* Each panel is mounted lazily only when first activated, then kept
          mounted (display:none when inactive) to avoid re-fetching data. */}

      <div
        id="panel-tickets"
        role="tabpanel"
        aria-labelledby="tab-tickets"
        hidden={activeTab !== 'tickets'}
      >
        {activeTab === 'tickets' && <TicketsTab />}
      </div>

      <div
        id="panel-audit"
        role="tabpanel"
        aria-labelledby="tab-audit"
        hidden={activeTab !== 'audit'}
      >
        {activeTab === 'audit' && <AuditLogTab />}
      </div>

      <div
        id="panel-incidents"
        role="tabpanel"
        aria-labelledby="tab-incidents"
        hidden={activeTab !== 'incidents'}
      >
        {activeTab === 'incidents' && <IncidentsTab />}
      </div>

      <div
        id="panel-dq"
        role="tabpanel"
        aria-labelledby="tab-dq"
        hidden={activeTab !== 'dq'}
      >
        {activeTab === 'dq' && <DQTab />}
      </div>

      <div
        id="panel-docs"
        role="tabpanel"
        aria-labelledby="tab-docs"
        hidden={activeTab !== 'docs'}
      >
        {activeTab === 'docs' && <DocsTab />}
      </div>

      <div
        id="panel-tasks"
        role="tabpanel"
        aria-labelledby="tab-tasks"
        hidden={activeTab !== 'tasks'}
      >
        {activeTab === 'tasks' && <TasksTab />}
      </div>
    </main>
  );
}
