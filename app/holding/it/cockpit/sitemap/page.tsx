// app/holding/it/cockpit/sitemap/page.tsx
// Visual tree sitemap — top-down diagram with CSS branch lines.
// PBS 2026-07-25. Knowledge → Sitemap.

import Link from 'next/link';

// ── Data ──────────────────────────────────────────────────────────────────────

type SitemapNode = {
  label: string;
  href?: string;
  warn?: boolean;
  children?: SitemapNode[];
};

// Color palette: level 0=root, 1=area, 2=section, 3=page, 4=sub-page
const LEVEL_COLORS = ['#E8476A', '#F5A623', '#26B5A8', '#5BB8D4', '#90CAD6'];
const LEVEL_TEXT   = ['#fff',    '#fff',    '#fff',    '#fff',    '#1B1B1B'];

const TREE: SitemapNode = {
  label: 'namkhan-bi',
  href: '/',
  children: [
    {
      label: 'Holding', href: '/holding',
      children: [
        { label: 'CEO', href: '/holding/ceo' },
        { label: 'Legal', href: '/holding/legal' },
        { label: 'Finance', href: '/holding/finance', children: [
          { label: 'Clients', href: '/holding/finance/clients' },
          { label: 'Invoices', href: '/holding/finance/invoices' },
        ]},
        { label: 'Strategy', href: '/holding/strategy' },
        {
          label: 'IT', href: '/holding/it',
          children: [
            { label: 'Properties', href: '/holding/properties' },
            { label: 'Users', href: '/holding/users' },
            { label: 'Bugs', href: '/holding/bugs' },
            {
              label: 'IT Cockpit', href: '/holding/it/cockpit',
              children: [
                { label: 'Home', href: '/holding/it/cockpit' },
                { label: 'Fleet', href: '/holding/it/cockpit/team', children: [
                  { label: 'Team', href: '/holding/it/cockpit/team' },
                  { label: 'Skills', href: '/holding/it/cockpit/skills' },
                  { label: 'Memory', href: '/holding/it/cockpit/knowledge' },
                ]},
                { label: 'Knowledge', href: '/holding/it/cockpit/docs', children: [
                  { label: 'All Docs', href: '/holding/it/cockpit/docs' },
                  { label: 'Schemas', href: '/holding/it/cockpit/schemas' },
                  { label: 'Freshness', href: '/holding/it/cockpit/freshness' },
                  { label: 'Sitemap', href: '/holding/it/cockpit/sitemap' },
                ]},
                { label: 'Ops', href: '/holding/it/cockpit/tasks', children: [
                  { label: 'Tasks', href: '/holding/it/cockpit/tasks' },
                  { label: 'Activity', href: '/holding/it/cockpit/activity' },
                  { label: 'Chat', href: '/holding/it/cockpit/chat' },
                  { label: 'Health', href: '/holding/it/cockpit/health' },
                ]},
                { label: 'Build', href: '/holding/it/cockpit/deploys', children: [
                  { label: 'Deploys', href: '/holding/it/cockpit/deploys' },
                  { label: 'Checks', href: '/holding/it/cockpit/checks' },
                  { label: 'Cost', href: '/holding/it/cockpit/cost' },
                  { label: 'Module Docs', href: '/holding/it/cockpit/specs' },
                  { label: '+ New spec', href: '/holding/it/cockpit/specs/new' },
                ]},
              ],
            },
          ],
        },
      ],
    },
    {
      label: 'Revenue', href: '/revenue',
      children: [
        { label: 'Pulse', href: '/revenue/pulse' },
        { label: 'Briefing', href: '/revenue/briefing' },
        { label: 'Pickup', href: '/revenue/pickup' },
        { label: 'Pace', href: '/revenue/pace' },
        { label: 'Demand', href: '/revenue/demand' },
        { label: 'Markets', href: '/revenue/markets' },
        { label: 'Compset', href: '/revenue/compset', children: [
          { label: '[hotel]', href: '/revenue/compset' },
        ]},
        { label: 'Parity', href: '/revenue/parity' },
        { label: 'Channels', href: '/revenue/channels', children: [
          { label: '[source]', href: '/revenue/channels' },
          { label: 'Promotions', href: '/revenue/promotions' },
        ]},
        { label: 'Rate Plans', href: '/revenue/rateplans' },
        { label: 'Reports', href: '/revenue/reports', children: [
          { label: 'Render', href: '/revenue/reports/render' },
          { label: 'Scheduled', href: '/revenue/reports/scheduled' },
        ]},
        { label: 'Leakage', href: '/revenue/leakage' },
        { label: 'Lighthouse', href: '/revenue/lighthouse' },
      ],
    },
    {
      label: 'Marketing', href: '/marketing',
      children: [
        { label: 'Overview', href: '/marketing/overview' },
        { label: 'Audience', href: '/marketing/audience' },
        { label: 'Campaigns', href: '/marketing/campaigns', children: [
          { label: 'New', href: '/marketing/campaigns/new' },
          { label: '[campaign]', href: '/marketing/campaigns' },
        ]},
        { label: 'Media', href: '/marketing/media', children: [
          { label: 'Pics', href: '/marketing/media' },
          { label: 'Videos', href: '/marketing/media' },
          { label: 'Clarify', href: '/marketing/media' },
          { label: 'Coverage', href: '/marketing/media' },
          { label: 'OTA Profiles', href: '/marketing/media/profiles' },
        ]},
        { label: 'YouTube', href: '/marketing/youtube', children: [
          { label: 'Dashboard', href: '/marketing/youtube' },
          { label: 'Playlists', href: '/marketing/youtube/playlists' },
          { label: 'Planning', href: '/marketing/youtube/planning' },
          { label: 'Production', href: '/marketing/youtube/production' },
        ]},
        { label: 'GBP', href: '/marketing/social/google-business' },
        { label: 'Subscribers', href: '/marketing/subscribers' },
        { label: 'Compiler', href: '/marketing/compiler', warn: true },
      ],
    },
    {
      label: 'Operations', href: '/operations',
      children: [
        { label: 'Inventory', href: '/operations/inventory', children: [
          { label: 'Items', href: '/operations/inventory/items' },
          { label: 'Stock', href: '/operations/inventory/stock' },
          { label: 'Movements', href: '/operations/inventory/movements' },
          { label: 'Low Stock', href: '/operations/inventory/low-stock' },
          { label: 'Suppliers', href: '/operations/inventory/suppliers' },
          { label: 'POs', href: '/operations/inventory/purchase-orders' },
        ]},
        { label: 'QA', href: '/operations/qa', children: [
          { label: 'Registry', href: '/operations/qa/registry' },
        ]},
        { label: 'SOPs', href: '/operations/sops', children: [
          { label: '[sop]', href: '/operations/sops' },
          { label: 'Preview', href: '/operations/sops' },
        ]},
        { label: 'Restaurant', href: '/operations/restaurant' },
        { label: 'Spa', href: '/operations/spa' },
        { label: 'Retail', href: '/operations/retail' },
        { label: 'Transport', href: '/operations/transport' },
        { label: 'Staff', href: '/operations/staff' },
        { label: 'Attendance', href: '/operations/attendance' },
        { label: 'Today', href: '/operations/today' },
      ],
    },
    {
      label: 'Sales', href: '/sales',
      children: [
        { label: 'Pipeline', href: '/sales/pipeline' },
        { label: 'Accounts', href: '/sales/accounts' },
        { label: 'Inquiries', href: '/sales/inquiries' },
        { label: 'Leads', href: '/sales/leads' },
        { label: 'Packages', href: '/sales/packages' },
        { label: 'Proposals', href: '/sales/proposals' },
        { label: 'Mails', href: '/sales/mails' },
      ],
    },
    {
      label: 'Finance', href: '/finance',
      children: [
        { label: 'P&L', href: '/finance/pnl' },
        { label: 'Ledger', href: '/finance/ledger' },
        { label: 'Budget', href: '/finance/budget' },
        { label: 'HR', href: '/finance/hr', children: [
          { label: 'Schedule', href: '/finance/hr/schedule' },
          { label: 'Attendance', href: '/finance/hr/attendance' },
          { label: 'Onboarding', href: '/finance/hr/onboarding' },
          { label: 'Recruitment', href: '/finance/hr/recruitment' },
        ]},
        { label: 'POS', href: '/finance/pos' },
        { label: 'Transactions', href: '/finance/transactions' },
        { label: 'Reports', href: '/finance/reports' },
      ],
    },
    {
      label: 'Guest', href: '/guest',
      children: [
        { label: 'Newsletters', href: '/guest/newsletters', children: [
          { label: 'Broadcasts', href: '/guest/newsletters' },
          { label: 'Sequences', href: '/guest/newsletters' },
          { label: 'Director', href: '/guest/newsletters' },
        ]},
        { label: 'Reputation', href: '/guest/reputation' },
        { label: 'Retreats', href: '/guest/retreats', children: [
          { label: '[program]', href: '/guest/retreats' },
        ]},
        { label: 'Reviews', href: '/guest/reviews' },
        { label: 'Loyalty', href: '/guest/loyalty' },
        { label: 'Directory', href: '/guest/directory' },
        { label: 'Behaviour', href: '/guest/behaviour' },
      ],
    },
    {
      label: 'Settings', href: '/settings',
      children: [
        { label: 'Property', href: '/settings/property', children: [
          { label: 'Rooms', href: '/settings/property' },
          { label: 'Activities', href: '/settings/property' },
          { label: 'Facilities', href: '/settings/property' },
          { label: 'Transport', href: '/settings/property' },
          { label: 'Audience', href: '/settings/property' },
        ]},
        { label: 'Users', href: '/settings/users' },
        { label: 'Media', href: '/settings/media' },
        { label: 'Brain', href: '/settings/brain' },
        { label: 'Rate Plans', href: '/settings/rate-plans' },
        { label: 'Guardrails', href: '/settings/guardrails' },
      ],
    },
    {
      label: 'University', href: '/university',
      children: [
        { label: 'Articles', href: '/university' },
        { label: 'Ask Window', href: '/university/ask' },
      ],
    },
    {
      label: 'Mail', href: '/mail',
      children: [
        { label: 'Inbox', href: '/mail' },
        { label: 'Analytics', href: '/mail/analytics' },
        { label: 'Rules', href: '/mail/rules' },
      ],
    },
  ],
};

// ── Tree renderer ─────────────────────────────────────────────────────────────

function countNodes(node: SitemapNode): number {
  return 1 + (node.children ?? []).reduce((n, c) => n + countNodes(c), 0);
}

function TreeNode({ node, depth }: { node: SitemapNode; depth: number }) {
  const hasChildren = (node.children ?? []).length > 0;
  const bg = LEVEL_COLORS[Math.min(depth, LEVEL_COLORS.length - 1)];
  const fg = LEVEL_TEXT[Math.min(depth, LEVEL_TEXT.length - 1)];
  const isWarn = node.warn;

  const box = (
    <div style={{
      background: isWarn ? '#B8542A' : bg,
      color: fg,
      padding: depth === 0 ? '6px 16px' : '4px 10px',
      borderRadius: 20,
      fontSize: depth === 0 ? 13 : depth <= 2 ? 11 : 10,
      fontWeight: depth <= 1 ? 700 : 600,
      whiteSpace: 'nowrap',
      cursor: node.href ? 'pointer' : 'default',
      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      textDecoration: 'none',
      display: 'block',
      textAlign: 'center',
    }}>
      {node.label}{isWarn ? ' ⚠' : ''}
    </div>
  );

  return (
    <div className="tree-node-wrapper">
      {node.href ? (
        <Link href={node.href} style={{ textDecoration: 'none' }}>{box}</Link>
      ) : box}

      {hasChildren && (
        <>
          {/* Explicit stem line — avoids :has() CSS selector */}
          <div style={{ width: 1, height: 12, background: '#C8C0B0', margin: '0 auto' }} />
          <ul className="tree-children">
            {(node.children ?? []).map((child) => (
              <li key={child.label + (child.href ?? '')} className="tree-child">
                <TreeNode node={child} depth={depth + 1} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SitemapPage() {
  const total = countNodes(TREE);

  return (
    <div style={{ padding: '24px', overflowX: 'auto', minWidth: 0 }}>
      <style>{`
        /* ── Tree structure ── */
        .tree-node-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* Children row */
        .tree-children {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          list-style: none;
          margin: 0;
          padding: 0;
          position: relative;
          padding-top: 24px;
        }

        /* Each child item */
        .tree-child {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 6px;
          position: relative;
        }

        /* Vertical line going up from each child to the horizontal bar */
        .tree-child::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 1px;
          height: 12px;
          background: #C8C0B0;
        }

        /* Horizontal bar connecting siblings */
        .tree-child::after {
          content: '';
          position: absolute;
          top: 0;
          height: 1px;
          background: #C8C0B0;
          left: 0;
          right: 0;
        }

        /* First child: horizontal bar only on the right half */
        .tree-child:first-child::after {
          left: 50%;
          right: 0;
        }

        /* Last child: horizontal bar only on the left half */
        .tree-child:last-child::after {
          left: 0;
          right: 50%;
        }

        /* Only child: no horizontal bar at all */
        .tree-child:first-child:last-child::after {
          display: none;
        }

        /* Stem is an explicit div in JSX — no :has() needed here */
      `}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1B1B1B', margin: '0 0 4px' }}>
          Application Sitemap
        </h1>
        <p style={{ fontSize: 11, color: '#5A5A5A', margin: 0 }}>
          {total} nodes · click any box to navigate · ⚠ = needs attention
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {['App root', 'Area', 'Section', 'Page', 'Sub-page'].map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: LEVEL_COLORS[i] }} />
            <span style={{ fontSize: 10, color: '#5A5A5A' }}>{label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: '#B8542A' }} />
          <span style={{ fontSize: 10, color: '#5A5A5A' }}>Needs attention</span>
        </div>
      </div>

      <div style={{ display: 'inline-block', minWidth: '100%', paddingBottom: 48 }}>
        <TreeNode node={TREE} depth={0} />
      </div>
    </div>
  );
}
