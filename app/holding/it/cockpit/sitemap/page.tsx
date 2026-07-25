'use client';

// app/holding/it/cockpit/sitemap/page.tsx
// Before/After nav restructuring cockpit.
// PBS 2026-07-25: toggle current vs proposed nav, execute with one button.

import { useState, useTransition } from 'react';
import Link from 'next/link';

// ── Color palette ─────────────────────────────────────────────────────────────
const LEVEL_COLORS = ['#E8476A', '#F5A623', '#26B5A8', '#5BB8D4', '#90CAD6'];
const LEVEL_TEXT   = ['#fff',    '#fff',    '#fff',    '#fff',    '#1B1B1B'];

// ── Types ─────────────────────────────────────────────────────────────────────
type NodeStatus = 'normal' | 'removed' | 'added' | 'renamed' | 'warn';

type SitemapNode = {
  label: string;
  href?: string;
  status?: NodeStatus;
  note?: string;
  children?: SitemapNode[];
};

// ── BEFORE — current state ────────────────────────────────────────────────────
const TREE_BEFORE: SitemapNode = {
  label: 'namkhan-bi', href: '/',
  children: [
    {
      label: 'Holding', href: '/holding',
      children: [
        { label: 'CEO', href: '/holding/ceo' },
        { label: 'Legal', href: '/holding/legal' },
        { label: 'Finance', href: '/holding/finance', children: [
          { label: 'Clients' }, { label: 'Invoices' },
        ]},
        { label: 'Strategy', href: '/holding/strategy' },
        { label: 'Properties', href: '/holding/properties' },
        { label: 'Users', href: '/holding/users' },
        {
          label: 'IT', href: '/holding/it',
          children: [
            {
              label: 'Cockpit', href: '/holding/it/cockpit',
              children: [
                { label: 'Home' },
                { label: 'Fleet', children: [
                  { label: 'Team' }, { label: 'Skills' }, { label: 'Memory' },
                ]},
                { label: 'Knowledge', children: [
                  { label: 'All Docs' }, { label: 'Schemas' }, { label: 'Freshness' }, { label: 'Sitemap' },
                ]},
                { label: 'Inventory', status: 'warn', note: 'Broken link → /cockpit/supabase', children: [
                  { label: '/cockpit/supabase', status: 'warn', note: '404' },
                ]},
                { label: 'Ops', children: [
                  { label: 'Tasks' }, { label: 'Activity' }, { label: 'Chat' }, { label: 'Health' },
                ]},
                { label: 'Build', children: [
                  { label: 'Deploys' }, { label: 'Checks' }, { label: 'Cost' },
                  { label: 'Module Docs' }, { label: '+ New spec' },
                ]},
                { label: 'notify', href: '/holding/it/cockpit/notify', status: 'warn', note: 'Orphan — no nav link' },
                { label: 'platform-map', href: '/holding/it/cockpit/platform-map', status: 'warn', note: 'Orphan — no nav link' },
                { label: 'cockpit/users', href: '/holding/it/cockpit/users', status: 'warn', note: 'Duplicate of /holding/users' },
              ],
            },
          ],
        },
      ],
    },
    {
      label: 'Revenue', href: '/revenue',
      children: [
        { label: 'Pulse' }, { label: 'Briefing' }, { label: 'Pickup' }, { label: 'Pace' },
        { label: 'Demand' }, { label: 'Markets' }, { label: 'Compset' }, { label: 'Parity' },
        { label: 'Channels', children: [{ label: '[source]' }, { label: 'Promotions' }]},
        { label: 'Rate Plans' }, { label: 'Reports', children: [{ label: 'Render' }, { label: 'Scheduled' }]},
        { label: 'Leakage' }, { label: 'Lighthouse' },
      ],
    },
    {
      label: 'Marketing', href: '/marketing',
      children: [
        { label: 'Overview' }, { label: 'Audience' },
        { label: 'Campaigns', children: [{ label: 'New' }, { label: '[id]' }]},
        { label: 'Media', children: [
          { label: 'Pics' }, { label: 'Videos' }, { label: 'Clarify' }, { label: 'Coverage' }, { label: 'OTA Profiles' },
        ]},
        { label: 'YouTube', children: [
          { label: 'Dashboard' }, { label: 'Playlists' }, { label: 'Planning' }, { label: 'Production' },
        ]},
        { label: 'GBP' }, { label: 'Subscribers' },
        { label: 'Compiler', status: 'warn', note: 'Legacy design' },
      ],
    },
    {
      label: 'Operations', href: '/operations',
      children: [
        { label: 'Inventory', children: [
          { label: 'Items' }, { label: 'Stock' }, { label: 'Movements' },
          { label: 'Low Stock' }, { label: 'Suppliers' }, { label: 'POs' },
        ]},
        { label: 'QA' }, { label: 'SOPs' },
        { label: 'Restaurant' }, { label: 'Spa' }, { label: 'Retail' }, { label: 'Transport' },
        { label: 'Staff' }, { label: 'Attendance' }, { label: 'Today' },
      ],
    },
    {
      label: 'Sales', href: '/sales',
      children: [
        { label: 'Pipeline' }, { label: 'Accounts' }, { label: 'Inquiries' },
        { label: 'Leads' }, { label: 'Packages' }, { label: 'Proposals' }, { label: 'Mails' },
      ],
    },
    {
      label: 'Finance', href: '/finance',
      children: [
        { label: 'P&L' }, { label: 'Ledger' }, { label: 'Budget' },
        { label: 'HR', children: [
          { label: 'Schedule' }, { label: 'Attendance' }, { label: 'Onboarding' }, { label: 'Recruitment' },
        ]},
        { label: 'POS' }, { label: 'Transactions' }, { label: 'Reports' },
      ],
    },
    {
      label: 'Guest', href: '/guest',
      children: [
        { label: 'Newsletters', children: [{ label: 'Broadcasts' }, { label: 'Sequences' }, { label: 'Director' }]},
        { label: 'Reputation' }, { label: 'Retreats' }, { label: 'Reviews' },
        { label: 'Loyalty' }, { label: 'Directory' }, { label: 'Behaviour' },
      ],
    },
    {
      label: 'Settings', href: '/settings',
      children: [
        { label: 'Property', children: [
          { label: 'Rooms' }, { label: 'Activities' }, { label: 'Facilities' },
          { label: 'Transport' }, { label: 'Audience' },
        ]},
        { label: 'Users' }, { label: 'Media' }, { label: 'Brain' }, { label: 'Rate Plans' }, { label: 'Guardrails' },
      ],
    },
    { label: 'University', href: '/university', children: [{ label: 'Articles' }, { label: 'Ask Window' }] },
    { label: 'Mail', href: '/mail', children: [{ label: 'Inbox' }, { label: 'Analytics' }, { label: 'Rules' }] },
  ],
};

// ── AFTER — proposed restructuring ────────────────────────────────────────────
const TREE_AFTER: SitemapNode = {
  label: 'namkhan-bi', href: '/',
  children: [
    {
      label: 'Holding', href: '/holding',
      children: [
        { label: 'CEO' }, { label: 'Legal' },
        { label: 'Finance', children: [{ label: 'Clients' }, { label: 'Invoices' }]},
        { label: 'Strategy' }, { label: 'Properties' }, { label: 'Users' },
        {
          label: 'IT', href: '/holding/it',
          children: [
            {
              label: 'Cockpit', href: '/holding/it/cockpit',
              children: [
                { label: 'Home' },
                { label: 'Fleet', children: [{ label: 'Team' }, { label: 'Skills' }, { label: 'Memory' }]},
                { label: 'Knowledge', children: [
                  { label: 'All Docs' }, { label: 'Schemas' }, { label: 'Freshness' }, { label: 'Sitemap' },
                  { label: 'Platform Map', status: 'added', note: 'Promoted from orphan' },
                ]},
                // Inventory group REMOVED
                { label: 'Inventory (removed)', status: 'removed', note: 'Was broken → /cockpit/supabase' },
                { label: 'Ops', children: [
                  { label: 'Tasks' }, { label: 'Activity' }, { label: 'Chat' }, { label: 'Health' },
                  { label: 'Alerts', status: 'added', note: 'Was orphan "notify" page' },
                ]},
                { label: 'Build', children: [
                  { label: 'Deploys' }, { label: 'Checks' }, { label: 'Cost' },
                  { label: 'Module Docs' }, { label: '+ New spec' },
                ]},
                { label: 'cockpit/users', status: 'removed', note: 'Redirects to /holding/users' },
              ],
            },
          ],
        },
      ],
    },
    // Revenue, Marketing, Operations, Sales, Finance, Guest, Settings — unchanged
    {
      label: 'Revenue', href: '/revenue',
      children: [
        { label: 'Pulse' }, { label: 'Briefing' }, { label: 'Pickup' }, { label: 'Pace' },
        { label: 'Demand' }, { label: 'Markets' }, { label: 'Compset' }, { label: 'Parity' },
        { label: 'Channels', children: [{ label: '[source]' }, { label: 'Promotions' }]},
        { label: 'Rate Plans' }, { label: 'Reports', children: [{ label: 'Render' }, { label: 'Scheduled' }]},
        { label: 'Leakage' }, { label: 'Lighthouse' },
      ],
    },
    {
      label: 'Marketing', href: '/marketing',
      children: [
        { label: 'Overview' }, { label: 'Audience' },
        { label: 'Campaigns', children: [{ label: 'New' }, { label: '[id]' }]},
        { label: 'Media', children: [{ label: 'Pics' }, { label: 'Videos' }, { label: 'Clarify' }, { label: 'Coverage' }, { label: 'OTA Profiles' }]},
        { label: 'YouTube', children: [{ label: 'Dashboard' }, { label: 'Playlists' }, { label: 'Planning' }, { label: 'Production' }]},
        { label: 'GBP' }, { label: 'Subscribers' },
        { label: 'Compiler', status: 'warn', note: 'Legacy design — modernize next' },
      ],
    },
    {
      label: 'Operations', href: '/operations',
      children: [
        { label: 'Inventory', children: [{ label: 'Items' }, { label: 'Stock' }, { label: 'Movements' }, { label: 'Low Stock' }, { label: 'Suppliers' }, { label: 'POs' }]},
        { label: 'QA' }, { label: 'SOPs' }, { label: 'Restaurant' }, { label: 'Spa' },
        { label: 'Retail' }, { label: 'Transport' }, { label: 'Staff' }, { label: 'Attendance' }, { label: 'Today' },
      ],
    },
    { label: 'Sales', href: '/sales', children: [
      { label: 'Pipeline' }, { label: 'Accounts' }, { label: 'Inquiries' },
      { label: 'Leads' }, { label: 'Packages' }, { label: 'Proposals' }, { label: 'Mails' },
    ]},
    { label: 'Finance', href: '/finance', children: [
      { label: 'P&L' }, { label: 'Ledger' }, { label: 'Budget' },
      { label: 'HR', children: [{ label: 'Schedule' }, { label: 'Attendance' }, { label: 'Onboarding' }, { label: 'Recruitment' }]},
      { label: 'POS' }, { label: 'Transactions' }, { label: 'Reports' },
    ]},
    { label: 'Guest', href: '/guest', children: [
      { label: 'Newsletters', children: [{ label: 'Broadcasts' }, { label: 'Sequences' }, { label: 'Director' }]},
      { label: 'Reputation' }, { label: 'Retreats' }, { label: 'Reviews' },
      { label: 'Loyalty' }, { label: 'Directory' }, { label: 'Behaviour' },
    ]},
    { label: 'Settings', href: '/settings', children: [
      { label: 'Property', children: [{ label: 'Rooms' }, { label: 'Activities' }, { label: 'Facilities' }, { label: 'Transport' }, { label: 'Audience' }]},
      { label: 'Users' }, { label: 'Media' }, { label: 'Brain' }, { label: 'Rate Plans' }, { label: 'Guardrails' },
    ]},
    { label: 'University', children: [{ label: 'Articles' }, { label: 'Ask Window' }] },
    { label: 'Mail', children: [{ label: 'Inbox' }, { label: 'Analytics' }, { label: 'Rules' }] },
  ],
};

// ── Change summary ────────────────────────────────────────────────────────────
const CHANGES = [
  { type: 'remove', label: 'Remove Inventory group from cockpit nav', detail: 'Was pointing to /cockpit/supabase (404). Group removed entirely.' },
  { type: 'add',    label: 'Add "Alerts" to Ops group', detail: 'Promotes orphan /cockpit/notify page. Renamed to "Alerts" — more descriptive.' },
  { type: 'add',    label: 'Add "Platform Map" to Knowledge group', detail: 'Promotes orphan /cockpit/platform-map page into Knowledge nav.' },
  { type: 'remove', label: 'Remove cockpit/users — redirect to /holding/users', detail: 'Duplicate of /holding/users. Add redirect page so old links still work.' },
];

// ── Tree rendering ────────────────────────────────────────────────────────────
function TreeNode({ node, depth }: { node: SitemapNode; depth: number }) {
  const hasChildren = (node.children ?? []).length > 0;
  const st = node.status ?? 'normal';

  const bg = st === 'removed' ? '#FFEBEE'
    : st === 'added'   ? '#E8F5E9'
    : st === 'renamed' ? '#FFF8E1'
    : st === 'warn'    ? '#FFF3E0'
    : LEVEL_COLORS[Math.min(depth, LEVEL_COLORS.length - 1)];

  const fg = (st === 'removed' || st === 'added' || st === 'renamed' || st === 'warn')
    ? '#1B1B1B'
    : LEVEL_TEXT[Math.min(depth, LEVEL_TEXT.length - 1)];

  const border = st === 'removed' ? '2px solid #D32F2F'
    : st === 'added'   ? '2px solid #2E7D32'
    : st === 'warn'    ? '2px dashed #F57F17'
    : 'none';

  const labelText = st === 'removed' ? `✕ ${node.label}`
    : st === 'added'   ? `+ ${node.label}`
    : st === 'warn'    ? `⚠ ${node.label}`
    : node.label;

  const box = (
    <div title={node.note} style={{
      background: bg, color: fg,
      padding: depth === 0 ? '6px 16px' : '4px 10px',
      borderRadius: 20,
      fontSize: depth === 0 ? 13 : depth <= 2 ? 11 : 10,
      fontWeight: depth <= 1 ? 700 : 600,
      whiteSpace: 'nowrap',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      textDecoration: st === 'removed' ? 'line-through' : 'none',
      border,
      cursor: node.href ? 'pointer' : 'default',
      textAlign: 'center' as const,
    }}>
      {labelText}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {node.href && st !== 'removed' ? (
        <Link href={node.href} style={{ textDecoration: 'none' }}>{box}</Link>
      ) : box}

      {hasChildren && (
        <>
          <div style={{ width: 1, height: 12, background: '#C8C0B0', margin: '0 auto' }} />
          <ul style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start',
            listStyle: 'none', margin: 0, padding: 0, position: 'relative', paddingTop: 12 }}>
            {(node.children ?? []).map((child, idx, arr) => {
              const isFirst = idx === 0;
              const isLast = idx === arr.length - 1;
              const isOnly = arr.length === 1;
              return (
                <li key={child.label + idx} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '0 6px', position: 'relative',
                }}>
                  {/* Vertical stem up */}
                  <div style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 1, height: 12, background: '#C8C0B0',
                  }} />
                  {/* Horizontal connector */}
                  {!isOnly && (
                    <div style={{
                      position: 'absolute', top: 0, height: 1, background: '#C8C0B0',
                      left: isFirst ? '50%' : 0,
                      right: isLast ? '50%' : 0,
                    }} />
                  )}
                  <TreeNode node={child} depth={depth + 1} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SitemapPage() {
  const [view, setView] = useState<'before' | 'after'>('before');
  const [executing, startExecute] = useTransition();
  const [done, setDone] = useState(false);
  const [execErr, setExecErr] = useState<string | null>(null);

  const tree = view === 'before' ? TREE_BEFORE : TREE_AFTER;

  async function handleExecute() {
    startExecute(async () => {
      try {
        const res = await fetch('/api/cockpit/apply-nav-proposal', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const j = await res.json();
        if (!res.ok) { setExecErr(j.error ?? 'Failed'); return; }
        setDone(true);
      } catch (e: any) { setExecErr(e.message); }
    });
  }

  return (
    <div style={{ padding: '24px 24px 64px', background: '#FFFFFF', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1B1B1B', margin: '0 0 2px' }}>App Sitemap</h1>
          <p style={{ fontSize: 11, color: '#5A5A5A', margin: 0 }}>
            Toggle Before / After to see the proposed restructuring · click any node to navigate
          </p>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid #E6DFCC', borderRadius: 6, overflow: 'hidden', marginLeft: 'auto' }}>
          {(['before', 'after'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '7px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: view === v ? '#1F3A2E' : '#FFFFFF',
              color: view === v ? '#FFFFFF' : '#5A5A5A',
              letterSpacing: '0.05em', textTransform: 'uppercase' as const,
            }}>
              {v === 'before' ? 'Current' : 'Proposed'}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { color: LEVEL_COLORS[0], label: 'Root' },
          { color: LEVEL_COLORS[1], label: 'Area' },
          { color: LEVEL_COLORS[2], label: 'Section' },
          { color: LEVEL_COLORS[3], label: 'Page' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: color }} />
            <span style={{ fontSize: 10, color: '#5A5A5A' }}>{label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: '#E8F5E9', border: '2px solid #2E7D32' }} />
          <span style={{ fontSize: 10, color: '#2E7D32', fontWeight: 700 }}>+ Added</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: '#FFEBEE', border: '2px solid #D32F2F' }} />
          <span style={{ fontSize: 10, color: '#D32F2F', fontWeight: 700 }}>✕ Removed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: '#FFF3E0', border: '2px dashed #F57F17' }} />
          <span style={{ fontSize: 10, color: '#F57F17', fontWeight: 700 }}>⚠ Issue</span>
        </div>
      </div>

      {/* Proposed changes panel */}
      {view === 'after' && (
        <div style={{ marginBottom: 20, background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 6, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1B1B1B', marginBottom: 10 }}>
            Proposed changes ({CHANGES.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CHANGES.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0,
                  background: c.type === 'remove' ? '#FFEBEE' : '#E8F5E9',
                  color: c.type === 'remove' ? '#D32F2F' : '#2E7D32',
                }}>
                  {c.type === 'remove' ? '✕ remove' : '+ add'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1B1B1B' }}>{c.label}</span>
                <span style={{ fontSize: 11, color: '#8A8A8A' }}>{c.detail}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
            {done ? (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2E7D32' }}>
                ✓ Executed — changes pushed to GitHub, Vercel deploying
              </div>
            ) : (
              <button onClick={handleExecute} disabled={executing} style={{
                fontSize: 12, fontWeight: 700, padding: '8px 20px', borderRadius: 4,
                background: executing ? '#5A5A5A' : '#1F3A2E', color: '#FFFFFF',
                border: 'none', cursor: executing ? 'not-allowed' : 'pointer',
                letterSpacing: '0.05em',
              }}>
                {executing ? 'Executing…' : 'Execute restructuring →'}
              </button>
            )}
            {execErr && (
              <span style={{ fontSize: 11, color: '#D32F2F' }}>{execErr}</span>
            )}
            {!done && (
              <span style={{ fontSize: 11, color: '#5A5A5A' }}>
                Pushes updated groups.ts + redirect page to GitHub → Vercel auto-deploys
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tree */}
      <div style={{ overflowX: 'auto', paddingBottom: 32 }}>
        <div style={{ display: 'inline-block', minWidth: '100%' }}>
          <TreeNode node={tree} depth={0} />
        </div>
      </div>
    </div>
  );
}
